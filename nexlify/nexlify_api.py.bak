import frappe
import json
import inspect

@frappe.whitelist()
def bypass_child_permission(*args, **kwargs):
    # تخطي فحص الصلاحيات القياسي بالسيرفر للجداول الفرعية المعرفة بالـ hooks
    return True

@frappe.whitelist()
def get_universal_tracker_config(doctype, docname=None):
    # جلب الـ Workflow النشط
    workflow_name = frappe.db.get_value("Workflow", {"document_type": doctype, "is_active": 1}, "name")
    
    if not workflow_name:
        return {"error": "No active workflow found"}

    # جلب المراحل مرتبة
    stages = frappe.get_all("Workflow Document State", 
        filters={"parent": workflow_name}, 
        fields=["state"], 
        order_by="idx asc"
    )

    # جلب إعدادات التراكر
    tracker_config = frappe.db.get_value(
        "Nexlify Tracker",
        {"document_type": doctype, "is_active": 1},
        ["workflow_field", "html_field", "name"],
        as_dict=True
    )

    if not tracker_config:
        return {"error": "No active tracker config found"}

    workflow_field = tracker_config.workflow_field or "workflow_state"

    # جلب التاسكات مع إضافة حقل link_doc_type
    tasks = frappe.get_all("Nexlify Tracker Task",
        filters={"parent": tracker_config.name},
        fields=["stage", "task", "field_name", "link_field_name", "link_doc_type"],
        order_by="idx asc"
    )

    # جلب الـ Meta الخاص بالـ DocType الرئيسي لمعرفة أنواع الحقول
    meta = frappe.get_meta(doctype)

    # معالجة أنواع الروابط وجلب الـ fieldtype ديناميكياً
    for t in tasks:
        t["is_link_type"] = False
        t["is_attach_type"] = False
        t["link_options"] = ""
        t["fieldtype"] = None
        
        # جلب بيانات الحقل من الـ Meta لمعرفة نوعه (Table, Link, Data, إلخ)
        if t.get("field_name"):
            df = meta.get_field(t.field_name)
            if df:
                t["fieldtype"] = df.fieldtype

        # لو المستخدم اختار DocType في حقل link_doc_type نستخدمه فوراً
        if t.get("link_doc_type"):
            t["is_link_type"] = True
            t["link_options"] = t.link_doc_type
        # لو مفيش، بنحاول فحص نوع حقل الرابط نفسه
        elif t.get("link_field_name"):
            df_link = meta.get_field(t.link_field_name)
            if df_link:
                if df_link.fieldtype == "Link":
                    t["is_link_type"] = True
                    t["link_options"] = df_link.options
                elif df_link.fieldtype in ["Attach", "Attach Image"]:
                    t["is_attach_type"] = True

    # جلب تاريخ الحالات
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
            except: pass
    
    return {
        "stages": stages,
        "history": history,
        "workflow_field": workflow_field,
        "tasks": tasks
    }

@frappe.whitelist()
def get_rfq_items_bypass(doctype, txt, searchfield, start, page_length, filters=None):
    if isinstance(filters, str):
        filters = json.loads(filters)
        
    parent_doc = filters.get("parent") if filters else None
    if not parent_doc:
        return []
    
    items = frappe.get_all(
        "Opportunity Client RFQ",
        filters={
            "parent": parent_doc,
            "opportunity_rfq_item": ["like", f"%{txt}%"]
        },
        fields=["name", "opportunity_rfq_item"],
        order_by="idx asc",
        ignore_permissions=True
    )
    
    return [[row.name, row.opportunity_rfq_item or row.name] for row in items]

@frappe.whitelist()
def get_estimation_tasks_bypass(doctype, txt, searchfield, start, page_length, filters=None):
    if isinstance(filters, str):
        filters = json.loads(filters)
        
    parent_doc = filters.get("parent") if filters else None
    if not parent_doc:
        return []
        
    tasks = frappe.get_all(
        "Project Estimation Tasks",
        filters={
            "parent": parent_doc,
            "task": ["like", f"%{txt}%"]
        },
        fields=["name", "task"],
        order_by="idx asc",
        ignore_permissions=True
    )
    
    return [[row.name, row.task or row.name] for row in tasks]

@frappe.whitelist()
def custom_search_link(*args, **kwargs):
    from frappe.desk.search import search_link
    
    doctype = kwargs.get("doctype") or (args[0] if args else None)
    
    if doctype and frappe.db.exists("DocType", doctype):
        if frappe.get_meta(doctype).istable:
            frappe.flags.ignore_permissions = True
            original_has_permission = frappe.has_permission
            frappe.has_permission = lambda *a, **k: True
            try:
                sig = inspect.signature(search_link)
                filtered_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
                return search_link(*args, **filtered_kwargs)
            finally:
                frappe.has_permission = original_has_permission
                
    sig = inspect.signature(search_link)
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return search_link(*args, **filtered_kwargs)

@frappe.whitelist()
def custom_validate_link(*args, **kwargs):
    from frappe.client import validate_link
    
    doctype = kwargs.get("doctype") or (args[0] if args else None)
    docname = kwargs.get("docname") or (args[1] if len(args) > 1 else None)
    
    if doctype and frappe.db.exists("DocType", doctype):
        if frappe.get_meta(doctype).istable and docname:
            return {"name": docname}
            
    sig = inspect.signature(validate_link)
    filtered_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return validate_link(*args, **filtered_kwargs)