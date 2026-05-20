import frappe

app_name = "nexlify"
app_title = "Nexlify"
app_publisher = "Kamal Adel"
app_description = "Nexlify ERP - Universal Tracker Engine"
app_email = "Kamal.adel@outlook.com"
app_license = "mit"

# --- Dynamic JavaScript Loading based on Workflow ---
def get_workflow_doctypes():
    """إرجاع كل أنواع المستندات المرتبطة بـ Workflow نشط"""
    try:
        # نجيب كل document_type من جدول Workflow، اللي لسه شغالين
        doctypes = frappe.get_all("Workflow",
                                  filters={"is_active": 1},
                                  pluck="document_type")
        # نحولهم لديكشنري بالشكل المطلوب لـ doctype_js
        return {dt: "public/js/utils/nexlify_tracker.js" for dt in doctypes}
    except Exception:
        # لو حصل أي خطأ (قاعدة بيانات مش جاهزة وقت التثبيت مثلاً)
        # نرجع ديكشنري فاضي ومافيش مشكلة
        return {}

doctype_js = get_workflow_doctypes()

# --- Whitelisted Methods Override ---
override_whitelisted_methods = {
    "frappe.desk.search.search_link": "nexlify.nexlify_api.custom_search_link",
    "frappe.client.validate_link": "nexlify.nexlify_api.custom_validate_link"
}

# --- Permissions for Child Tables ---
has_permission = {
    "Project Estimation Tasks": "nexlify.nexlify_api.has_permission",
    "estimation": "nexlify.nexlify_api.has_permission",
    "Project Estimation Tasks Manpower": "nexlify.nexlify_api.has_permission",
    "custom_rfq_table": "nexlify.nexlify_api.has_permission"
}

# --- Fixtures ---
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [["module", "in", ["Estimation", "Nexlify Tracker"]]]
    },
    {
        "dt": "Property Setter",
        "filters": [["doc_type", "in", ["Opportunity", "Project Estimation", "Opportunity Client Rfq"]]]
    },
    {
        "dt": "Server Script",
        "filters": [["module", "in", ["Estimation", "Nexlify Tracker"]]]
    },
    {
        "dt": "Client Script",
        "filters": [["dt", "in", ["Opportunity", "Project Estimation", "Opportunity Client Rfq"]]]
    },
    {
        "dt": "Print Format",
        "filters": [["doc_type", "in", ["Opportunity", "Project Estimation", "Opportunity Client Rfq"]]]
    },
    {
        "dt": "Workflow",
        "filters": [["document_type", "in", ["Opportunity", "Project Estimation", "Opportunity Client Rfq"]]]
    }
]
