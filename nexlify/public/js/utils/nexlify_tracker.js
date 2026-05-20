// nexlify_tracker.js - Universal Tracker Sidebar
// (c) Nexlify - Performance-optimized version

let _nexlify_tracker_timeout = null;

frappe.ui.form.on('*', {
    refresh: function (frm) {
        // لا نرسم التراكر إلا إذا كان المستند محفوظًا
        if (!frm.is_new()) {
            draw_nexlify_sidebar_tracker(frm);
        }
    },
    workflow_state: function (frm) {
        draw_nexlify_sidebar_tracker(frm);
    }
});

function draw_nexlify_sidebar_tracker(frm) {
    // تجنب المكالمات المتكررة – debounce 300ms
    if (_nexlify_tracker_timeout) clearTimeout(_nexlify_tracker_timeout);
    _nexlify_tracker_timeout = setTimeout(() => {
        _draw_tracker_now(frm);
    }, 300);
}

function _draw_tracker_now(frm) {
    frappe.call({
        method: "nexlify.nexlify_api.get_universal_tracker_config",
        args: {
            doctype: frm.doctype,
            docname: frm.doc.name
        },
        callback: function (r) {
            // نتجاهل الأخطاء (مفيش Workflow نشط) ولا نرسم حاجة
            if (!r.message || r.message.error) {
                $('#nexlify-smart-tracker').remove();
                return;
            }

            const config = r.message;
            const currentState = frm.doc[config.workflow_field];

            // رسم أولي
            render_sidebar_tracker_html(frm, config.stages, currentState, config.history || [], config.tasks || []);

            // بدل ربط change على كل حقل يدويًا، نستخدم نظام Frappe لمراقبة النموذج
            // أولاً نزيل أي مستمع قديم بنفس الاسم
            frm.off('change', _nexlify_field_change_handler);
            // ثم نضيف مستمع واحد لأي تغيير في المستند
            frm.on('change', _nexlify_field_change_handler);

            function _nexlify_field_change_handler() {
                // نعيد رسم التراكر عند أي تغيير (بـ debounce)
                draw_nexlify_sidebar_tracker(frm);
            }
        }
    });
}

function render_sidebar_tracker_html(frm, stages, currentState, history, tasks) {
    // إزالة التراكر القديم
    $('#nexlify-smart-tracker').remove();

    const display_stages = stages.slice(0, -1);
    const current_index = stages.findIndex(s => s.state === currentState);
    const is_dark = $('html').attr('data-theme') === 'dark';
    const is_submitted = frm.doc.docstatus === 1;
    const is_mobile = $(window).width() <= 767;

    const tracker_id = 'nexlify-smart-tracker';
    const main_body_id = 'nexlify-main-body';
    const main_arrow_id = 'nexlify-main-arrow';

    const style_tag = `
        <style>
            #${tracker_id} { width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; margin-bottom: 15px; }
            .sidebar-section-tracker { 
                padding: 12px; border-radius: 8px; border: 1px solid ${is_dark ? '#1e293b' : '#e2e8f0'};
                background: ${is_dark ? '#111827' : '#ffffff'}; width: 100%; box-sizing: border-box;
            }
            .mobile-btn-style {
                background: ${is_dark ? '#1e293b' : '#f8fafc'}; padding: 12px 16px; border-radius: 8px;
                border: 1px solid ${is_dark ? '#334155' : '#e2e8f0'}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .main-tracker-header { cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; }
            .nexlify-sidebar-stage { position: relative; padding-bottom: 18px; display: flex; gap: 10px; align-items: flex-start; width: 100%; box-sizing: border-box; }
            .nexlify-sidebar-stage:last-child { padding-bottom: 0; }
            .nexlify-v-line { position: absolute; left: 14px; top: 28px; width: 2px; height: calc(100% - 18px); z-index: 1; }
            .nexlify-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 2; font-size: 11px; font-weight: bold; flex-shrink: 0; cursor: pointer; }
            .stage-header { cursor: pointer; display: flex; justify-content: space-between; align-items: flex-start; flex: 1; min-width: 0; gap: 8px; }
            .stage-title { white-space: normal; word-break: break-word; flex: 1; line-height: 1.4; transition: color 0.2s; }
            .stage-details { display: none; margin-top: 8px; padding-left: 2px; overflow: hidden; }
            .nexlify-link-tag {
                text-decoration: none !important; color: #1a73e8 !important; font-size: 10px;
                background: ${is_dark ? '#1e293b' : '#f0f7ff'}; padding: 4px 6px; border-radius: 4px;
                border: 1px solid ${is_dark ? '#334155' : '#dbeafe'}; margin-left: 8px; display: inline-flex;
                align-items: center; justify-content: center; transition: all 0.2s; cursor: pointer;
            }
            .nexlify-link-tag:hover {
                background: ${is_dark ? '#334155' : '#dbeafe'};
                color: #1557b0 !important;
            }
        </style>
    `;

    let steps_html = display_stages.map((stage, i) => {
        const is_last_visible = (i === display_stages.length - 1);
        const history_record = history.filter(h => h.workflow_state === stage.state).pop();
        const is_completed = i < current_index || (is_last_visible && (is_submitted || !!history_record));
        const is_current = i === current_index;

        let color = is_completed ? '#28a745' : (is_current ? '#1a73e8' : (is_dark ? '#334155' : '#cbd5e1'));
        let line_color = i < current_index ? '#28a745' : (is_dark ? '#334155' : '#e2e8f0');
        let icon = is_completed ? '✓' : (i + 1);

        const details_id = `details-${i}-${frm.doc.name}`;
        const arrow_id = `arrow-${i}-${frm.doc.name}`;

        let history_html = '';
        if (is_completed && history_record) {
            let avatar_markup = '';
            if (history_record.user_image) {
                avatar_markup = `<img src="${history_record.user_image}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 2px;">`;
            } else {
                avatar_markup = `<div style="width: 20px; height: 20px; border-radius: 50%; background: ${is_dark ? '#1e293b' : '#e2e8f0'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;"><i class="fa fa-user" style="font-size: 10px; color: #888;"></i></div>`;
            }

            history_html = `
                <div style="font-size: 10px; color: #888; margin-top: 8px; display: flex; align-items: flex-start; gap: 8px; width: 100%;">
                    ${avatar_markup}
                    <div style="display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1;">
                        <div style="font-weight: 600; color: ${is_dark ? '#cbd5e1' : '#1e293b'}; white-space: normal; word-break: break-word; line-height: 1.2;">
                            ${history_record.full_name}
                        </div>
                        <div style="font-size: 9px; color: #888; line-height: 1.1;">
                            ${frappe.datetime.global_date_format(history_record.creation)}
                        </div>
                    </div>
                </div>`;
        }

        const stage_tasks = tasks.filter(t => t.stage === stage.state);
        let tasks_html = stage_tasks.map(t => {
            let is_done = false;
            let field_value = frm.doc[t.field_name];

            if (t.field_name === "custom_rfq_table") {
                let table_ok = field_value && Array.isArray(field_value) && field_value.length > 0;
                let client_rfq_value = frm.doc["custom_client_rfq"];
                let client_rfq_ok = client_rfq_value !== undefined && client_rfq_value !== null && client_rfq_value !== '';
                if (table_ok && client_rfq_ok) {
                    is_done = true;
                }
            } else if (t.fieldtype === "Table") {
                if (field_value && Array.isArray(field_value) && field_value.length > 0) {
                    is_done = true;
                }
            } else {
                if (field_value !== undefined && field_value !== null && field_value !== '') {
                    is_done = true;
                }
            }

            let link_markup = '';
            const link_val = t.link_field_name ? frm.doc[t.link_field_name] : null;

            if (link_val) {
                let target_url = '';
                if (t.is_link_type && t.link_options) {
                    target_url = `/app/${frappe.router.slug(t.link_options)}/${link_val}`;
                } else if (t.is_attach_type) {
                    target_url = link_val;
                }

                if (target_url) {
                    link_markup = `<a href="${target_url}" target="_blank" class="nexlify-link-tag" title="${link_val}"><i class="fa fa-external-link"></i></a>`;
                }
            }

            return `
                <div style="font-size: 10px; color: ${is_done ? '#28a745' : '#e53e3e'}; margin-top: 4px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="white-space: normal; word-break: break-word; flex: 1;"><span>${is_done ? '✓' : '○'}</span> ${__(t.task)}</div>
                    ${link_markup}
                </div>`;
        }).join('');

        return `
            <div class="nexlify-sidebar-stage">
                ${!is_last_visible ? `<div class="nexlify-v-line" style="background: ${line_color};"></div>` : ''}
                <div class="nexlify-dot" style="background: ${color}; color: white; border: 2px solid ${color};" onclick="$(this).next().find('.stage-header').click();">${icon}</div>
                <div style="flex: 1; min-width: 0; margin-top: 4px;">
                    <div class="stage-header" onclick="
                        var $det = $('#${details_id}'); var $arr = $('#${arrow_id}');
                        $det.slideToggle(300);
                        setTimeout(() => { $arr.css('transform', $det.is(':visible') ? 'rotate(90deg)' : 'rotate(0deg)'); }, 10);
                    ">
                        <span class="stage-title" style="font-size: 11px; font-weight: 600; color: ${is_dark ? '#cbd5e1' : '#1e293b'}; ${is_current ? 'color: #1a73e8;' : ''}">${__(stage.state)}</span>
                        <span id="${arrow_id}" style="font-size: 10px; color: #888; transition: transform 0.3s ease; display: inline-block; transform: ${is_current ? 'rotate(90deg)' : 'rotate(0deg)'};">▶</span>
                    </div>
                    
                    <div id="${details_id}" class="stage-details" style="${is_current ? 'display: block;' : 'display: none;'}">
                        ${tasks_html} ${history_html}
                    </div>
                </div>
            </div>`;
    }).join('');

    const header_style = is_mobile ? 'mobile-btn-style' : '';
    const border_bottom_color = `1px solid ${is_dark ? '#1e293b' : '#e2e8f0'}`;

    const tracker_html = `
        ${style_tag}
        <div id="${tracker_id}">
            <div class="sidebar-section-tracker" style="${is_mobile ? 'padding: 0; border: none; background: transparent;' : ''}">
                <div class="main-tracker-header ${header_style}" onclick="
                    var $body = $('#${main_body_id}'); 
                    var $arr = $('#${main_arrow_id}');
                    var $header = $(this);
                    
                    $body.slideToggle(400, function() {
                        var isVisible = $body.is(':visible');
                        $arr.text(isVisible ? '▼' : '▶');
                        if(!${is_mobile}) {
                            $header.css({
                                'border-bottom': isVisible ? '${border_bottom_color}' : 'none',
                                'margin-bottom': isVisible ? '12px' : '0',
                                'padding-bottom': isVisible ? '8px' : '0'
                            });
                        }
                    });
                " style="border-bottom: ${border_bottom_color}; padding-bottom: 8px; margin-bottom: 12px;">
                    <span style="font-size: ${is_mobile ? '13px' : '10px'}; font-weight: bold; text-transform: uppercase; color: ${is_mobile ? '#1a73e8' : '#888'};">
                        ${is_mobile ? 'Business Process' : __('Business Process')}
                    </span>
                    <span id="${main_arrow_id}" style="font-size: 12px; color: #888; font-weight: bold;">▼</span>
                </div>
                <div id="${main_body_id}" style="display: ${is_mobile ? 'none' : 'block'}; overflow: hidden; ${is_mobile ? `margin-top: 10px; padding: 15px; border-radius: 8px; background: ${is_dark ? '#111827' : '#ffffff'}; border: 1px solid ${is_dark ? '#1e293b' : '#e2e8f0'};` : ''}">
                    ${steps_html}
                </div>
            </div>
        </div>
    `;

    const target = is_mobile ? $(frm.layout.wrapper) : $(frm.wrapper).find('.layout-side-section');
    target.prepend(tracker_html);
}
