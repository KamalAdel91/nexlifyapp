app_name = "nexlify"
app_title = "Nexlify"
app_publisher = "Kamal Adel"
app_description = "Nexlify ERP - Universal Tracker Engine"
app_email = "Kamal.adel@outlook.com"
app_license = "mit"

app_include_js = [
    "/assets/nexlify/js/utils/nexlify_tracker.js"
]

doctype_js = {
    "Opportunity": "public/js/utils/nexlify_tracker.js"
}

override_whitelisted_methods = {
    "frappe.desk.search.search_link": "nexlify.nexlify_api.custom_search_link",
    "frappe.client.validate_link": "nexlify.nexlify_api.custom_validate_link"
}

has_permission = {
    "Project Estimation Tasks": "nexlify.nexlify_api.bypass_child_permission",
    "estimation": "nexlify.nexlify_api.bypass_child_permission",
    "Project Estimation Tasks Manpower": "nexlify.nexlify_api.bypass_child_permission",
    "custom_rfq_table": "nexlify.nexlify_api.bypass_child_permission"
}


fixtures = [
    {
        "dt": "Custom Field",
        "filters": [
            ["dt", "in", ["Opportunity"]]
        ]
    },
    {
        "dt": "Property Setter",
        "filters": [
            ["doc_type", "in", ["Opportunity"]]
        ]
    }
]