# Copyright (c) 2026, Kamal Adel and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ProjectEstimation(Document):
    pass


@frappe.whitelist()
def get_opportunity_rfq_items(opportunity):
    doc = frappe.get_doc('Opportunity', opportunity)
    items = []
    for row in doc.get('custom_rfq_table', []):
        items.append({
            'opportunity_rfq_item': row.opportunity_rfq_item,
            'opportunity_rfq_description': row.opportunity_rfq_description,
            'opportunity_rfq_uom': row.opportunity_rfq_uom,
            'opportunity_rfq_quantity': row.opportunity_rfq_quantity,
        })
    return items