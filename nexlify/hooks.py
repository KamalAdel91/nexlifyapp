app_name = "nexlify"
app_title = "Nexlify"
app_publisher = "Kamal Adel"
app_description = "Nexlify ERP - Universal Tracker Engine"
app_email = "Kamal.adel@outlook.com"
app_license = "mit"

# --- JavaScript Loading ---
# الملف ده مهم لوظائف التتبع، هنحمله فقط على الصفحات اللي بتحتاجه فعلًا
# عشان نخلي التطبيق خفيف، حمّلناه هنا على الـ Doctypes المحددة بس.
doctype_js = {
    "Opportunity": "public/js/utils/nexlify_tracker.js",
    "Project Estimation": "public/js/utils/nexlify_tracker.js",
    "Opportunity Client Rfq": "public/js/utils/nexlify_tracker.js",
    # أي Doctype تانية هتستخدم التتبع تضيفها هنا
}

# --- Whitelisted Methods Override ---
override_whitelisted_methods = {
    "frappe.desk.search.search_link": "nexlify.nexlify_api.custom_search_link",
    "frappe.client.validate_link": "nexlify.nexlify_api.custom_validate_link"
}

# --- Permissions for Child Tables ---
# استخدمنا الدالة has_permission عشان نضمن إن الجداول الابنة دي
# تقدر تنفتح بس من خلال الـ DocType الأب بتاعها وليس منفردة.
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
