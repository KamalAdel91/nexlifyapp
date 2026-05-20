from frappe import _
import frappe
import json
import inspect


@frappe.whitelist()
def get_universal_tracker_config(doctype, docname=None):
    """جلب إعدادات التتبع الشامل مع حالات الـ Workflow"""
    workflow_name = frappe.db.get_value("Workflow", {"document_type": doctype, "is_active": 1}, "name")
    
    if not workflow_name:
        return {"error": "No active workflow found"}

    # المراحل بالترتيب
    stages = frappe.get_all("Workflow Document State", 
        filters={"parent": workflow_name}, 
        fields=["state"], 
        order_by="idx asc"
    )

    # إعدادات التراكر
    tracker_config = frappe.db.get_value(
        "Nexlify Tracker",
        {"document_type": doctype, "is_active": 1},
        ["workflow_field", "html_field", "name"],
        as_dict=True
    )
    if not tracker_config:
        return {"error": "No active tracker config found"}

    workflow_field = tracker_config.workflow_field or "workflow_state"

    # التاسكات مع معلومات الحقول
    tasks = frappe.get_all("Nexlify Tracker Task",
        filters={"parent": tracker_config.name},
        fields=["stage", "task", "field_name", "link_field_name", "link_doc_type"],
        order_by="idx asc"
    )

    meta = frappe.get_meta(doctype)
    for t in tasks:
        t["is_link_type"] = False
        t["is_attach_type"] = False
        t["link_options"] = ""
        t["fieldtype"] = None
        
        if t.get("field_name"):
            df = meta.get_field(t.field_name)
            if df:
                t["fieldtype"] = df.fieldtype

        if t.get("link_doc_type"):
            t["is_link_type"] = True
            t["link_options"] = t.link_doc_type
        elif t.get("link_field_name"):
            df_link = meta.get_field(t.link_field_name)
            if df_link:
                if df_link.fieldtype == "Link":
                    t["is_link_type"] = True
                    t["link_options"] = df_link.options
                elif df_link.fieldtype in ["Attach", "Attach Image"]:
                    t["is_attach_type"] = True

    # تاريخ التغييرات
    history = []
    if docname:
        versions = frappe.get_all("Version",
            filters={"ref_doctype": doctype, "docname": docname},
            fields=["owner", "creation", "data"],
            order_by="creation asc"
        )
        for v in versions:
            try:
                data = json.loads(v.data)
                changed = data.get("changed", [])
                for change in changed:
                    if change[0] == workflow_field:
                        user_info = frappe.db.get_value("User", v.owner, ["full_name", "user_image"], as_dict=True) or {}
                        full_name = user_info.get("full_name") or v.owner
                        user_image = user_info.get("user_image") or ""
                        history.append({
                            "full_name": full_name,
                            "user_image": user_image,
                            "creation": v.creation,
                            "workflow_state": change[1]
                        })
            except:
                pass

    return {
        "stages": stages,
        "history": history,
        "workflow_field": workflow_field,
        "tasks": tasks
    }


@frappe.whitelist()
def get_rfq_items_bypass(doctype, txt, searchfield, start, page_length, filters=None):
    """إرجاع عناصر RFQ من الجدول الفرعي مع التحقق من صلاحية المستند الأب"""
    if isinstance(filters, str):
        filters = json.loads(filters)
        
    parent_doc = filters.get("parent") if filters else None
    if not parent_doc:
        return []

    # التأكد من صلاحية المستخدم على المستند الأب
    parent_doctype = frappe.db.get_value("Opportunity Client RFQ", parent_doc, "parenttype")
    if parent_doctype and not frappe.has_permission(doctype=parent_doctype, doc=parent_doc, ptype="read"):
        return []

    items = frappe.get_all(
        "Opportunity Client RFQ",
        filters={
            "parent": parent_doc,
            "opportunity_rfq_item": ["like", f"%{txt}%"]
        },
        fields=["name", "opportunity_rfq_item"],
        order_by="idx asc",
        limit_page_length=page_length,
        ignore_permissions=True   # آمن لأننا تأكدنا من صلاحية الأب
    )
    
    return [[row.name, row.opportunity_rfq_item or row.name] for row in items]


@frappe.whitelist()
def get_estimation_tasks_bypass(doctype, txt, searchfield, start, page_length, filters=None):
    """إرجاع المهام من الجدول الفرعي مع التحقق من صلاحية المستند الأب"""
    if isinstance(filters, str):
        filters = json.loads(filters)
        
    parent_doc = filters.get("parent") if filters else None
    if not parent_doc:
        return []

    parent_doctype = frappe.db.get_value("Project Estimation Tasks", parent_doc, "parenttype")
    if parent_doctype and not frappe.has_permission(doctype=parent_doctype, doc=parent_doc, ptype="read"):
        return []

    tasks = frappe.get_all(
        "Project Estimation Tasks",
        filters={
            "parent": parent_doc,
            "task": ["like", f"%{txt}%"]
        },
        fields=["name", "task"],
        order_by="idx asc",
        limit_page_length=page_length,
        ignore_permissions=True
    )
    
    return [[row.name, row.task or row.name] for row in tasks]


@frappe.whitelist()
def get_opportunity_rfq_items(opportunity):
    """إرجاع عناصر RFQ للفرصة بدون جلب المستند بالكامل"""
    if not frappe.has_permission("Opportunity", opportunity, "read"):
        return []
    return frappe.get_all("Opportunity Client RFQ",
                          filters={"parent": opportunity},
                          fields=["opportunity_rfq_item", "opportunity_rfq_description",
                                  "opportunity_rfq_uom", "opportunity_rfq_quantity"],
                          order_by="idx asc")


@frappe.whitelist()
def custom_search_link(*args, **kwargs):
    """توسيع البحث ليشمل الجداول الفرعية بشكل آمن"""
    from frappe.desk.search import search_link as original_search

    doctype = kwargs.get("doctype") or (args[0] if args else None)
    
    # لو Doctype موجود وهو جدول فرعي، نمرر ignore_permissions للأصلي
    if doctype and frappe.db.exists("DocType", doctype) and frappe.get_meta(doctype).istable:
        kwargs["ignore_permissions"] = True

    # إزالة أي وسائط غير متوافقة مع توقيع الدالة الأصلية
    sig = inspect.signature(original_search)
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return original_search(*args, **filtered_kwargs)


@frappe.whitelist()
def custom_validate_link(*args, **kwargs):
    """التحقق من الروابط للجداول الفرعية بدون اشتراط صلاحيات كاملة"""
    from frappe.client import validate_link as original_validate

    doctype = kwargs.get("doctype") or (args[0] if args else None)
    docname = kwargs.get("docname") or (args[1] if len(args) > 1 else None)

    if doctype and frappe.db.exists("DocType", doctype) and frappe.get_meta(doctype).istable:
        # لو جدول فرعي، نكتفي بالتأكد من وجود الاسم
        if docname and frappe.db.exists(doctype, docname):
            return {"name": docname}
        else:
            return {"name": ""}   # غير موجود نرجع فاضي

    sig = inspect.signature(original_validate)
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return original_validate(*args, **filtered_kwargs)


# --- صلاحيات الجداول الفرعية ---
def has_permission(doc, ptype, user):
    """
    منع الوصول المباشر للجداول الفرعية (قوائم، تقارير) ما عدا الأدوار المسموحة أو المالك.
    مطابقة للـ hooks.py: has_permission = { ... "nexlify.nexlify_api.has_permission"}
    """
    allowed_roles = ["Sales Manager", "System Manager"]
    user_roles = frappe.get_roles(user)
    if any(role in allowed_roles for role in user_roles):
        return True
    if hasattr(doc, "owner") and doc.owner == user:
        return True
    return False
