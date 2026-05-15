const formatCurrency = (value) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
}).format(value || 0);

function safeInit(label, callback) {
    try {
        callback();
    } catch (error) {
        console.error(`[init] ${label}`, error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    safeInit("charts", initCharts);
    safeInit("date-pickers", initDatePickers);
    safeInit("booking-availability", initBookingAvailability);
    safeInit("calendar-interactions", initCalendarInteractions);
    safeInit("calendar-block-time-modal", initCalendarBlockTimeModal);
    safeInit("calendar-event-viewer", initCalendarEventViewer);
    safeInit("calendar-agenda-modal", initCalendarAgendaModal);
    safeInit("sales-tabs", initSalesTabs);
    safeInit("customer-tabs", initCustomerTabs);
    safeInit("staff-tabs", initStaffTabs);
    safeInit("inventory-page", initInventoryPage);
    safeInit("services-page", initServicesPage);
    safeInit("vouchers-page", initVouchersPage);
    safeInit("analytics-page", initAnalyticsPage);
    safeInit("reviews-page", initReviewsPage);
    safeInit("pos", initPOS);
    safeInit("permission-loader", initPermissionLoader);
});

function initCharts() {
    document.querySelectorAll(".js-chart").forEach((canvas) => {
        const payload = canvas.dataset.chart;
        if (!payload || typeof Chart === "undefined") {
            return;
        }

        const isReferenceChart = canvas.classList.contains("js-dashboard-reference-chart");

        new Chart(canvas, {
            type: canvas.dataset.chartType || "line",
            data: JSON.parse(payload),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "top",
                        labels: {
                            usePointStyle: isReferenceChart,
                            boxWidth: isReferenceChart ? 8 : 40,
                            boxHeight: isReferenceChart ? 8 : 12,
                            color: "#4d5f79",
                            padding: isReferenceChart ? 22 : 12,
                            font: {
                                size: isReferenceChart ? 12 : 11,
                            },
                        },
                    },
                },
                scales: canvas.dataset.chartType === "line" ? {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: "#7488a3",
                        },
                        grid: {
                            color: "#edf1f7",
                        },
                        border: {
                            color: "#edf1f7",
                        },
                    },
                    x: {
                        ticks: {
                            color: "#7488a3",
                        },
                        grid: {
                            display: false,
                        },
                        border: {
                            color: "#edf1f7",
                        },
                    },
                } : {},
            },
        });
    });
}

function initDatePickers() {
    if (typeof flatpickr === "undefined") {
        return;
    }

    document.querySelectorAll(".js-datepicker").forEach((input) => {
        const calendarPicker = input.dataset.calendarPicker;
        const config = {
            dateFormat: "Y-m-d",
        };

        if (calendarPicker) {
            config.onChange = (selectedDates, dateStr, instance) => {
                if (calendarPicker === "week" && selectedDates[0]) {
                    markFlatpickrWeek(instance, selectedDates[0], "in-selected-week");
                }

                input.value = dateStr;
                input.form?.submit();
            };

            if (calendarPicker === "week") {
                config.onReady = (selectedDates, dateStr, instance) => {
                    const selectedDate = selectedDates[0] || parseDateInput(input.value);
                    markFlatpickrWeek(instance, selectedDate, "in-selected-week");
                };
                config.onMonthChange = (selectedDates, dateStr, instance) => {
                    const selectedDate = selectedDates[0] || parseDateInput(input.value);
                    markFlatpickrWeek(instance, selectedDate, "in-selected-week");
                };
                config.onYearChange = config.onMonthChange;
                config.onDayCreate = (dObj, dStr, instance, dayElem) => {
                    dayElem.addEventListener("mouseenter", () => {
                        markFlatpickrWeek(instance, dayElem.dateObj, "in-hover-week");
                    });
                    dayElem.addEventListener("mouseleave", () => {
                        clearFlatpickrWeek(instance, "in-hover-week");
                    });
                };
            }
        }

        flatpickr(input, config);
    });
}

function parseDateInput(value) {
    if (!value) {
        return new Date();
    }

    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function getWeekBounds(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

function clearFlatpickrWeek(instance, className) {
    instance.calendarContainer.querySelectorAll(`.${className}, .start-week, .end-week`).forEach((day) => {
        day.classList.remove(className);
        if (className === "in-selected-week") {
            day.classList.remove("start-week", "end-week");
        }
    });
}

function markFlatpickrWeek(instance, date, className) {
    if (!instance || !date) {
        return;
    }

    clearFlatpickrWeek(instance, className);
    const { start, end } = getWeekBounds(date);

    instance.calendarContainer.querySelectorAll(".flatpickr-day").forEach((day) => {
        if (!day.dateObj) {
            return;
        }

        const dayDate = new Date(day.dateObj);
        dayDate.setHours(12, 0, 0, 0);

        if (dayDate >= start && dayDate <= end) {
            day.classList.add(className);
        }

        if (className === "in-selected-week") {
            if (dayDate.toDateString() === start.toDateString()) {
                day.classList.add("start-week");
            }
            if (dayDate.toDateString() === end.toDateString()) {
                day.classList.add("end-week");
            }
        }
    });
}

function initBookingAvailability() {
    document.querySelectorAll(".js-booking-form").forEach((form) => {
        const trigger = form.querySelector(".js-load-slots");
        const slotTarget = form.querySelector(".js-availability-target");
        const resolveServiceIds = () => {
            const checkedServices = Array.from(form.querySelectorAll(".js-booking-service:checked")).map((input) => input.value);
            if (checkedServices.length > 0) {
                return checkedServices.join(",");
            }

            const serviceSelect = form.querySelector("[name='service_ids[]']");
            return Array.from(serviceSelect?.selectedOptions ?? []).map((option) => option.value).join(",");
        };
        const resetSlotTarget = () => {
            if (!slotTarget) {
                return;
            }

            slotTarget.innerHTML = "<option value=''>Pilih slot</option>";
        };

        if (!trigger) {
            return;
        }

        trigger.addEventListener("click", async () => {
            const staffId = form.querySelector("[name='staff_id']")?.value;
            const date = form.querySelector("[name='date']")?.value;
            const timeInput = form.querySelector(".js-calendar-time-input, [name='time']");
            const serviceIds = resolveServiceIds();

            if (!staffId || !date || !serviceIds || !slotTarget) {
                if (slotTarget) {
                    slotTarget.innerHTML = "<option value=''>Lengkapi staff, tanggal, dan layanan</option>";
                }
                return;
            }

            const response = await fetch(`/api/bookings/availability?staff_id=${staffId}&date=${date}&service_ids=${serviceIds}`);
            const data = await response.json();
            const options = ["<option value=''>Pilih slot</option>"];
            data.slots
                .filter((slot) => slot.available)
                .slice(0, 16)
                .forEach((slot) => {
                    options.push(`<option value="${slot.time}">${slot.time}</option>`);
                });
            slotTarget.innerHTML = options.join("");
            if (timeInput && data.slots?.some((slot) => slot.available)) {
                timeInput.value = data.slots.find((slot) => slot.available)?.time || "";
            }
        });

        form.querySelector(".js-availability-target")?.addEventListener("change", (event) => {
            const timeInput = form.querySelector(".js-calendar-time-input, [name='time']");
            if (timeInput) {
                timeInput.value = event.target.value;
            }
        });

        form.querySelectorAll(".js-booking-service, [name='staff_id'], [name='date']").forEach((input) => {
            input.addEventListener("change", resetSlotTarget);
        });
    });
}

function initCalendarInteractions() {
    const fab = document.querySelector(".js-calendar-fab");
    const fabMenu = document.getElementById("calendarFabMenu");
    const fabClose = document.querySelector(".js-calendar-fab-close");
    const selectedSlotDisplay = document.querySelector(".js-selected-slot-display");
    const dateInputs = document.querySelectorAll(".js-calendar-date-input");
    const timeInputs = document.querySelectorAll(".js-calendar-time-input");
    const endTimeInputs = document.querySelectorAll(".js-calendar-end-time-input");
    const staffInputs = document.querySelectorAll(".js-calendar-staff-input");
    const scrollNowButton = document.querySelector(".js-calendar-scroll-now");

    const closeFabMenu = () => {
        fabMenu?.classList.remove("is-open");
        fab?.classList.remove("is-open");
        fab?.setAttribute("aria-expanded", "false");
    };

    fab?.addEventListener("click", () => {
        fabMenu?.classList.toggle("is-open");
        fab?.classList.toggle("is-open");
        fab?.setAttribute("aria-expanded", fab?.classList.contains("is-open") ? "true" : "false");
    });

    fabClose?.addEventListener("click", () => {
        closeFabMenu();
    });

    document.addEventListener("click", (event) => {
        if (!fabMenu || !fab) {
            return;
        }

        const target = event.target;
        if (fab.contains(target) || fabMenu.contains(target)) {
            return;
        }

        closeFabMenu();
    });

    document.querySelectorAll(".js-calendar-slot").forEach((slot) => {
        slot.addEventListener("click", () => {
            const time = slot.dataset.time;
            const staffId = slot.dataset.staffId;
            const staffName = slot.dataset.staffName;
            const date = slot.dataset.date || document.querySelector(".calendar-date-input")?.value || new Date().toISOString().slice(0, 10);

            if (selectedSlotDisplay) {
                selectedSlotDisplay.textContent = `${date} • ${time} • ${staffName}`;
            }

            timeInputs.forEach((input) => {
                input.value = time;
                input.dataset.slotValue = time;
            });

            endTimeInputs.forEach((input) => {
                input.value = addMinutes(time, 30);
                input.dataset.slotValue = addMinutes(time, 30);
            });

            dateInputs.forEach((input) => {
                input.value = date;
                input.dataset.slotValue = date;
            });

            staffInputs.forEach((input) => {
                input.value = staffId;
                input.dataset.slotValue = staffId;
            });
        });
    });

    scrollNowButton?.addEventListener("click", () => {
        scrollCalendarToNow();
    });
}

function scrollCalendarToNow() {
    const indicator = document.querySelector(".now-indicator");
    const scrollBox = document.querySelector(".cal-body-scroll");

    if (!indicator || !scrollBox) {
        window.location.reload();
        return;
    }

    const nextTop = Math.max(0, indicator.offsetTop - (scrollBox.clientHeight * 0.35));
    scrollBox.scrollTo({
        top: nextTop,
        behavior: "smooth",
    });
}

function addMinutes(time, minutesToAdd) {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + minutesToAdd;
    const nextHours = Math.floor(totalMinutes / 60) % 24;
    const nextMinutes = totalMinutes % 60;
    return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function initCalendarBlockTimeModal() {
    const modal = document.getElementById("blockTimeModal");

    if (!modal) {
        return;
    }

    const form = modal.querySelector(".js-calendar-block-form");
    const titleNode = modal.querySelector(".js-calendar-block-title");
    const blockIdInput = modal.querySelector(".js-calendar-block-id");
    const staffInput = modal.querySelector(".js-calendar-block-staff");
    const dateInput = modal.querySelector(".js-calendar-block-date");
    const startInput = modal.querySelector('[data-block-time-input="start"]');
    const endInput = modal.querySelector('[data-block-time-input="end"]');
    const descriptionInput = modal.querySelector(".js-calendar-block-description");
    const deleteButton = modal.querySelector(".js-calendar-block-delete");
    const saveButton = modal.querySelector(".js-calendar-block-save");
    const timeTriggers = Array.from(modal.querySelectorAll(".js-calendar-block-time-trigger"));
    const popover = modal.querySelector(".js-calendar-block-time-popover");
    const hoursColumn = modal.querySelector(".js-calendar-block-time-hours");
    const minutesColumn = modal.querySelector(".js-calendar-block-time-minutes");
    const startDisplay = modal.querySelector('[data-block-time-display="start"]');
    const endDisplay = modal.querySelector('[data-block-time-display="end"]');
    const createAction = form?.getAttribute("action") || "";
    const updateAction = createAction.replace(/\/calendar\/blocks$/, "/calendar/blocks/update");
    const triggerButtons = Array.from(document.querySelectorAll('[data-bs-target="#blockTimeModal"]'));
    const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
    const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));
    let activeTimeTarget = "start";
    let selectedHour = "00";
    let selectedMinute = "00";
    let isEditMode = false;
    let timeSelectionStage = "hour";

    const parseTime = (value) => {
        const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
        return match ? { hour: match[1], minute: match[2] } : { hour: "00", minute: "00" };
    };

    const compareTime = (left, right) => {
        const [leftHour, leftMinute] = String(left || "00:00").split(":").map(Number);
        const [rightHour, rightMinute] = String(right || "00:00").split(":").map(Number);
        return (leftHour * 60 + leftMinute) - (rightHour * 60 + rightMinute);
    };

    const syncTimeTrigger = (target) => {
        const input = target === "start" ? startInput : endInput;
        const display = target === "start" ? startDisplay : endDisplay;
        const trigger = modal.querySelector(`[data-block-time-target="${target}"]`);
        const value = String(input?.value || "").trim();

        if (display) {
            display.textContent = value || "HH:mm";
        }

        trigger?.classList.toggle("is-placeholder", value === "");
    };

    const syncSaveState = () => {
        const isValid = Boolean(
            staffInput?.value
            && dateInput?.value
            && startInput?.value
            && endInput?.value
            && String(descriptionInput?.value || "").trim() !== ""
            && compareTime(endInput?.value, startInput?.value) > 0
        );

        if (saveButton) {
            saveButton.disabled = !isValid;
        }
    };

    const hidePopover = () => {
        popover?.setAttribute("hidden", "hidden");
        timeTriggers.forEach((button) => button.classList.remove("is-open"));
        timeSelectionStage = "hour";
    };

    const commitSelectedTime = () => {
        const nextValue = `${selectedHour}:${selectedMinute}`;
        if (activeTimeTarget === "start" && startInput) {
            startInput.value = nextValue;
            if (endInput && (!endInput.value || compareTime(endInput.value, nextValue) <= 0)) {
                endInput.value = addMinutes(nextValue, 30);
                syncTimeTrigger("end");
            }
        }
        if (activeTimeTarget === "end" && endInput) {
            endInput.value = nextValue;
        }
        syncTimeTrigger(activeTimeTarget);
        syncSaveState();
    };

    const renderTimeOptions = () => {
        if (!hoursColumn || !minutesColumn) {
            return;
        }

        hoursColumn.querySelectorAll(".calendar-block-time-popover__option").forEach((node) => node.remove());
        minutesColumn.querySelectorAll(".calendar-block-time-popover__option").forEach((node) => node.remove());

        hours.forEach((hour) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `calendar-block-time-popover__option${hour === selectedHour ? " is-active" : ""}`;
            button.textContent = hour;
            button.addEventListener("click", () => {
                selectedHour = hour;
                timeSelectionStage = "minute";
                renderTimeOptions();
            });
            hoursColumn.appendChild(button);
        });

        minutes.forEach((minute) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `calendar-block-time-popover__option${minute === selectedMinute ? " is-active" : ""}`;
            button.textContent = minute;
            button.addEventListener("click", () => {
                selectedMinute = minute;
                commitSelectedTime();
                renderTimeOptions();
                hidePopover();
            });
            minutesColumn.appendChild(button);
        });
    };

    const openPopover = (target) => {
        const trigger = modal.querySelector(`[data-block-time-target="${target}"]`);

        if (!trigger || !popover || !form) {
            return;
        }

        activeTimeTarget = target;
        const currentValue = target === "start" ? startInput?.value : endInput?.value;
        const parsed = parseTime(currentValue);
        selectedHour = parsed.hour;
        selectedMinute = parsed.minute;
        timeSelectionStage = "hour";
        renderTimeOptions();

        const formRect = form.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        popover.style.left = `${triggerRect.left - formRect.left}px`;
        popover.style.top = `${triggerRect.bottom - formRect.top}px`;
        popover.removeAttribute("hidden");

        timeTriggers.forEach((button) => button.classList.toggle("is-open", button === trigger));
    };

    const resetForCreate = () => {
        isEditMode = false;
        form.setAttribute("action", createAction);
        blockIdInput.value = "";
        titleNode.textContent = "Blokir Waktu";
        if (staffInput) {
            staffInput.value = staffInput.dataset.slotValue || staffInput.dataset.defaultValue || "";
        }
        if (dateInput) {
            dateInput.value = dateInput.dataset.slotValue || dateInput.dataset.defaultValue || "";
        }
        if (startInput) {
            startInput.value = startInput.dataset.slotValue || startInput.dataset.defaultValue || "";
        }
        if (endInput) {
            endInput.value = endInput.dataset.slotValue || endInput.dataset.defaultValue || "";
        }
        if (descriptionInput) {
            descriptionInput.value = "";
        }
        if (deleteButton) {
            deleteButton.hidden = true;
        }
        syncTimeTrigger("start");
        syncTimeTrigger("end");
        syncSaveState();
    };

    const populateFromEvent = (card) => {
        isEditMode = true;
        form.setAttribute("action", updateAction);
        blockIdInput.value = card.dataset.eventId || "";
        titleNode.textContent = "Blokir Waktu";
        if (staffInput) {
            staffInput.value = card.dataset.eventStaffId || "";
        }
        if (dateInput) {
            dateInput.value = card.dataset.eventDate || "";
        }
        if (startInput) {
            startInput.value = String(card.dataset.eventStart || "").slice(11, 16);
        }
        if (endInput) {
            endInput.value = String(card.dataset.eventEnd || "").slice(11, 16);
        }
        if (descriptionInput) {
            descriptionInput.value = card.dataset.eventNotes || card.dataset.eventTitle || "";
        }
        if (deleteButton) {
            deleteButton.hidden = false;
        }
        syncTimeTrigger("start");
        syncTimeTrigger("end");
        syncSaveState();
    };

    triggerButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (button.dataset.bsTarget === "#blockTimeModal") {
                resetForCreate();
            }
        });
    });

    timeTriggers.forEach((button) => {
        button.addEventListener("click", () => {
            const target = button.dataset.blockTimeTarget || "start";
            if (!popover?.hasAttribute("hidden") && activeTimeTarget === target) {
                hidePopover();
                return;
            }
            openPopover(target);
        });
    });

    [staffInput, dateInput, startInput, endInput, descriptionInput].forEach((input) => {
        input?.addEventListener("input", syncSaveState);
        input?.addEventListener("change", syncSaveState);
    });

    document.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const blockedCard = target.closest('[data-calendar-event="1"][data-event-type="blocked"]');
        if (blockedCard) {
            event.preventDefault();
            populateFromEvent(blockedCard);
            if (typeof bootstrap !== "undefined") {
                bootstrap.Modal.getOrCreateInstance(modal).show();
            }
            return;
        }

        if (popover && !popover.hasAttribute("hidden") && !target.closest(".calendar-block-form__time-wrap") && !target.closest(".calendar-block-time-popover")) {
            hidePopover();
        }
    });

    modal.addEventListener("show.bs.modal", () => {
        hidePopover();
        if (!isEditMode) {
            resetForCreate();
        }
    });

    modal.addEventListener("hidden.bs.modal", () => {
        hidePopover();
        isEditMode = false;
        form.setAttribute("action", createAction);
    });

    syncTimeTrigger("start");
    syncTimeTrigger("end");
    syncSaveState();
}

function initCalendarEventViewer() {
    const modal = document.getElementById("calendarAgendaViewModal");

    if (!modal) {
        return;
    }

    const servicesNode = modal.querySelector(".js-agenda-view-services");
    const customerNode = modal.querySelector(".js-agenda-view-customer");
    const branchNode = modal.querySelector(".js-agenda-view-branch");
    const dateNode = modal.querySelector(".js-agenda-view-date");
    const updatedNode = modal.querySelector(".js-agenda-view-updated");
    const totalNode = modal.querySelector(".js-agenda-view-total");
    const statusToggle = modal.querySelector(".js-agenda-view-status-toggle");
    const statusLabel = modal.querySelector(".js-agenda-view-status-label");
    const statusMenu = modal.querySelector(".js-agenda-view-status-menu");

    let currentCards = [];
    let currentStatus = "new";
    let expandedIndex = 0;

    const statusConfig = {
        new: { label: "NEW", className: "is-new", iconClass: "" },
        confirmed: { label: "CONFIRMED", className: "is-confirmed", iconClass: "bi-hand-thumbs-up" },
        arrived: { label: "ARRIVED", className: "is-arrived", iconClass: "bi-emoji-smile" },
        started: { label: "STARTED", className: "is-started", iconClass: "bi-play-fill" },
        completed: { label: "COMPLETED", className: "is-completed", iconClass: "bi-check-lg" },
    };
    const statusClassNames = Object.values(statusConfig).map((config) => config.className);
    const statusIconClassNames = Object.values(statusConfig)
        .map((config) => config.iconClass)
        .filter(Boolean);

    const normalizeStatus = (value) => {
        const status = String(value || "new").toLowerCase();

        return statusConfig[status] ? status : "new";
    };

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[char]));

    const formatViewCurrency = (value) => `Rp ${new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0)}`;

    const parseEventDate = (value) => {
        if (!value) {
            return null;
        }

        const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

        if (!year || !month || !day) {
            return null;
        }

        return new Date(year, month - 1, day);
    };

    const formatViewDate = (value) => {
        const date = parseEventDate(value);

        if (!date) {
            return "";
        }

        return new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(date).replace(/\./g, "");
    };

    const formatDurationLabel = (minutes) => {
        const total = Math.max(0, Number(minutes) || 0);
        const hours = Math.floor(total / 60);
        const mins = total % 60;

        if (hours && mins) {
            return `${hours}h ${mins}min`;
        }

        if (hours) {
            return `${hours}h`;
        }

        return `${mins}min`;
    };

    const readEvent = (card) => ({
        element: card,
        type: card.dataset.eventType || "booking",
        title: card.dataset.eventTitle || "Walk-In",
        subtitle: card.dataset.eventSubtitle || "Layanan salon",
        staff: card.dataset.eventStaff || "Staff",
        reference: card.dataset.eventReference || "",
        status: normalizeStatus(card.dataset.eventStatus),
        start: card.dataset.eventStart || "",
        end: card.dataset.eventEnd || "",
        date: card.dataset.eventDate || "",
        duration: Number(card.dataset.eventDuration || 0),
        price: Number(card.dataset.eventPrice || 0),
    });

    const matchingCardsFor = (card) => {
        const reference = card.dataset.eventReference || "";
        const date = card.dataset.eventDate || "";
        const type = card.dataset.eventType || "";

        if (!reference || type === "blocked") {
            return [card];
        }

        return Array.from(document.querySelectorAll('[data-calendar-event="1"]')).filter((candidate) => (
            candidate.dataset.eventType === type
            && candidate.dataset.eventReference === reference
            && candidate.dataset.eventDate === date
        ));
    };

    const renderStatus = () => {
        const config = statusConfig[currentStatus] || statusConfig.new;

        if (statusLabel) {
            statusLabel.textContent = config.label;
        }

        if (statusToggle) {
            statusToggle.className = `calendar-agenda-view__status js-agenda-view-status-toggle ${config.className}`;
            const chevron = statusMenu && !statusMenu.hidden ? "bi-chevron-up" : "bi-chevron-down";
            const icon = statusToggle.querySelector("i");

            if (icon) {
                icon.classList.remove("bi-chevron-up", "bi-chevron-down");
                icon.classList.add(chevron);
            }
        }
    };

    const renderServices = (events) => {
        if (!servicesNode) {
            return;
        }

        servicesNode.innerHTML = events.map((item, index) => {
            const letter = (item.subtitle || item.title || "L").trim().charAt(0).toUpperCase() || "L";
            const expanded = index === expandedIndex;
            const startTime = item.start.slice(11, 16) || "00:00";

            return `
                <div class="calendar-agenda-view-service ${expanded ? "is-expanded" : ""}">
                    <button class="calendar-agenda-view-service__head" type="button" data-agenda-view-service="${index}">
                        <span class="calendar-agenda-view-service__avatar">${escapeHtml(letter)}</span>
                        <span class="calendar-agenda-view-service__title">${escapeHtml(item.subtitle)} -</span>
                        <i class="bi ${expanded ? "bi-chevron-up" : "bi-chevron-down"}"></i>
                    </button>
                    <div class="calendar-agenda-view-service__body">
                        <div class="calendar-agenda-view-service__detail"><span>Jam mulai</span><strong>${escapeHtml(startTime)}</strong></div>
                        <div class="calendar-agenda-view-service__detail"><span>Durasi</span><strong>${escapeHtml(formatDurationLabel(item.duration))}</strong></div>
                        <div class="calendar-agenda-view-service__detail"><span>Staff</span><strong>${escapeHtml(item.staff)}</strong></div>
                        <div class="calendar-agenda-view-service__detail"><span>Harga</span><strong>${escapeHtml(formatViewCurrency(item.price))}</strong></div>
                    </div>
                </div>
            `;
        }).join("");

        servicesNode.querySelectorAll("[data-agenda-view-service]").forEach((button) => {
            button.addEventListener("click", () => {
                const index = Number(button.dataset.agendaViewService);
                expandedIndex = expandedIndex === index ? -1 : index;
                renderServices(events);
            });
        });
    };

    const updateCalendarCards = () => {
        currentCards.forEach((card) => {
            const config = statusConfig[currentStatus] || statusConfig.new;

            card.dataset.eventStatus = currentStatus;
            card.classList.remove(...statusClassNames);
            card.classList.add(config.className);

            const statusIcon = card.querySelector(".calendar-event-card__status-icon");
            if (statusIcon) {
                statusIcon.classList.remove(...statusIconClassNames);

                if (config.iconClass) {
                    statusIcon.classList.add(config.iconClass);
                }
            }

            const statusSmall = card.querySelector(".calendar-event-popover small");
            if (statusSmall) {
                const event = readEvent(card);
                const statusText = `${config.label.charAt(0)}${config.label.slice(1).toLowerCase()}`;
                statusSmall.textContent = `${event.staff} - ${statusText}`;
            }
        });
    };

    const render = () => {
        const events = currentCards.map(readEvent).sort((a, b) => a.start.localeCompare(b.start));

        if (!events.length) {
            return;
        }

        const first = events[0];
        const total = events.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
        const customer = first.title && first.title.toLowerCase() !== "walk-in" ? first.title : "Walk-In";
        currentStatus = normalizeStatus(first.status);

        if (customerNode) {
            customerNode.textContent = customer === "Walk-In" ? "Pelanggan Walk-In" : customer;
        }

        if (branchNode) {
            branchNode.textContent = "Star Salon";
        }

        if (dateNode) {
            dateNode.textContent = formatViewDate(first.date) || first.date;
        }

        if (totalNode) {
            totalNode.textContent = `Total: ${formatViewCurrency(total)}`;
        }

        if (updatedNode) {
            const now = new Date();
            updatedNode.textContent = `Terakhir diperbarui pada: ${formatViewDate(first.date) || first.date} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        }

        renderStatus();
        renderServices(events);
    };

    statusToggle?.addEventListener("click", () => {
        if (!statusMenu) {
            return;
        }

        statusMenu.hidden = !statusMenu.hidden;
        statusToggle.setAttribute("aria-expanded", statusMenu.hidden ? "false" : "true");
        renderStatus();
    });

    statusMenu?.querySelectorAll("[data-agenda-view-status]").forEach((option) => {
        option.addEventListener("click", () => {
            currentStatus = normalizeStatus(option.dataset.agendaViewStatus);
            statusMenu.hidden = true;
            statusToggle?.setAttribute("aria-expanded", "false");
            renderStatus();
            updateCalendarCards();
        });
    });

    document.addEventListener("click", (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const eventCard = target.closest('[data-calendar-event="1"]');

        if (eventCard && eventCard.dataset.eventType !== "blocked") {
            event.preventDefault();
            currentCards = matchingCardsFor(eventCard);
            expandedIndex = Math.max(0, currentCards.indexOf(eventCard));
            render();

            if (typeof bootstrap !== "undefined") {
                bootstrap.Modal.getOrCreateInstance(modal).show();
            }

            return;
        }

        if (statusMenu && !target.closest(".calendar-agenda-view__status-wrap")) {
            statusMenu.hidden = true;
            statusToggle?.setAttribute("aria-expanded", "false");
            renderStatus();
        }
    });

    modal.addEventListener("hidden.bs.modal", () => {
        if (statusMenu) {
            statusMenu.hidden = true;
        }

        statusToggle?.setAttribute("aria-expanded", "false");
        currentCards = [];
    });
}

function initCalendarAgendaModal() {
    const form = document.querySelector(".js-calendar-agenda-form");
    if (!form) {
        return;
    }
    const agendaModalEl = form.closest(".modal");
    const entryTriggers = Array.from(document.querySelectorAll(".js-calendar-entry-trigger[data-bs-target='#agendaModal']"));

    let customers = [];
    let staffOptions = [];
    let resourceOptions = [];
    let agendaDiscountOptions = [];
    let agendaOwnedVouchers = [];
    let salesCatalogs = {
        services: [],
        packages: [],
        products: [],
        vouchers: [],
        plans: [],
        payable: [],
    };
    try {
        customers = JSON.parse(form.dataset.customers || "[]");
    } catch (error) {
        customers = [];
    }
    try {
        staffOptions = JSON.parse(form.dataset.staff || "[]");
    } catch (error) {
        staffOptions = [];
    }
    try {
        resourceOptions = JSON.parse(form.dataset.resources || "[]");
    } catch (error) {
        resourceOptions = [];
    }
    try {
        agendaDiscountOptions = JSON.parse(form.dataset.discounts || "[]");
    } catch (error) {
        agendaDiscountOptions = [];
    }
    try {
        agendaOwnedVouchers = JSON.parse(form.dataset.ownedVouchers || "[]");
    } catch (error) {
        agendaOwnedVouchers = [];
    }
    try {
        salesCatalogs = {
            ...salesCatalogs,
            ...JSON.parse(form.dataset.salesCatalogs || "{}"),
        };
    } catch (error) {
        salesCatalogs = {
            services: [],
            packages: [],
            products: [],
            vouchers: [],
            plans: [],
            payable: [],
        };
    }
    const todayValue = form.dataset.today || "";
    const salesUrl = form.dataset.salesUrl || "/sales?tab=invoices";

    const serviceSearch = form.querySelector(".js-agenda-service-search");
    const serviceInputContainer = form.querySelector(".js-agenda-service-inputs");
    const serviceCards = Array.from(form.querySelectorAll(".js-agenda-service-card"));
    const filterButtons = Array.from(form.querySelectorAll(".js-agenda-filter"));
    const pickerBack = form.querySelector(".js-agenda-picker-back");
    const selectedPanel = form.querySelector(".js-agenda-selected");
    const selectedRows = form.querySelector(".js-agenda-selected-rows");
    const summary = form.querySelector(".js-agenda-summary");
    const footerAction = form.querySelector(".js-agenda-footer-action");
    const agendaTitle = form.querySelector(".js-agenda-title");
    const checkoutButton = form.querySelector(".js-agenda-checkout");
    const submitButton = form.querySelector(".js-agenda-submit");
    const salesCartToolbar = form.querySelector(".js-calendar-sales-cart-toolbar");
    const salesCatalogTabs = Array.from(form.querySelectorAll(".js-calendar-sales-tab"));
    const salesSubfilters = form.querySelector(".js-calendar-sales-subfilters");
    const salesGrid = form.querySelector(".js-calendar-sales-grid");
    const salesEmpty = form.querySelector(".js-calendar-sales-empty");
    const reviewList = form.querySelector(".js-agenda-review-list");
    const reviewTotal = form.querySelector(".js-agenda-review-total");
    const reviewAddService = form.querySelector(".js-agenda-review-add-service");
    const checkoutLeft = form.querySelector(".js-agenda-checkout-left");
    const checkoutList = form.querySelector(".js-agenda-checkout-list");
    const checkoutBranch = form.querySelector(".js-agenda-checkout-branch");
    const checkoutSubtotal = form.querySelector(".js-agenda-checkout-subtotal");
    const checkoutDiscountTotal = form.querySelector(".js-agenda-checkout-discount-total");
    const checkoutTotal = form.querySelector(".js-agenda-checkout-total");
    const checkoutDue = form.querySelector(".js-agenda-checkout-due");
    const checkoutPayment = form.querySelector(".js-agenda-checkout-payment");
    const checkoutPaymentAmount = form.querySelector(".js-agenda-checkout-payment-amount");
    const checkoutPaymentDue = form.querySelector(".js-agenda-checkout-payment-due");
    const checkoutPaymentButtons = Array.from(form.querySelectorAll(".js-agenda-payment-method"));
    const checkoutPaymentList = form.querySelector(".js-agenda-payment-list");
    const checkoutPaymentComplete = form.querySelector(".js-agenda-payment-complete");
    const checkoutMoreToggle = form.querySelector(".js-agenda-more-toggle");
    const checkoutMoreMenu = form.querySelector(".js-agenda-more-menu");
    const checkoutViewInvoice = form.querySelector(".js-agenda-view-invoice");
    const invoiceView = form.querySelector(".js-agenda-invoice-view");
    const invoiceViewClose = form.querySelector(".js-agenda-invoice-view-close");
    const invoiceReceipt = form.querySelector(".js-agenda-invoice-receipt");
    const invoiceA5 = form.querySelector(".js-agenda-invoice-a5");
    const invoiceItems = form.querySelector(".js-agenda-invoice-items");
    const invoiceA5Items = form.querySelector(".js-agenda-invoice-a5-items");
    const invoiceSubtotal = form.querySelector(".js-agenda-invoice-subtotal");
    const invoiceTotal = form.querySelector(".js-agenda-invoice-total");
    const invoiceGrandTotal = form.querySelector(".js-agenda-invoice-grand-total");
    const invoiceRemaining = form.querySelector(".js-agenda-invoice-remaining");
    const invoiceA5Subtotal = form.querySelector(".js-agenda-invoice-a5-subtotal");
    const invoiceA5Total = form.querySelector(".js-agenda-invoice-a5-total");
    const invoiceA5GrandTotal = form.querySelector(".js-agenda-invoice-a5-grand-total");
    const invoiceA5Remaining = form.querySelector(".js-agenda-invoice-a5-remaining");
    const invoiceCustomer = form.querySelector(".js-agenda-invoice-customer");
    const invoiceStatus = form.querySelector(".js-agenda-invoice-status");
    const invoiceMeta = form.querySelector(".js-agenda-invoice-meta");
    const invoiceActions = form.querySelector(".js-agenda-invoice-actions");
    const invoiceFormatButtons = Array.from(form.querySelectorAll(".js-agenda-invoice-format"));
    const invoiceDownload = form.querySelector(".js-agenda-invoice-download");
    const invoicePrint = form.querySelector(".js-agenda-invoice-print");
    const invoiceCopyLink = form.querySelector(".js-agenda-invoice-copy-link");
    const invoiceEmail = form.querySelector(".js-agenda-invoice-email");
    const invoiceWhatsapp = form.querySelector(".js-agenda-invoice-whatsapp");
    const invoiceSide = form.querySelector(".js-agenda-invoice-side");
    const invoiceInfoPanel = form.querySelector(".js-agenda-invoice-info-panel");
    const invoicePayNow = form.querySelector(".js-agenda-invoice-pay-now");
    const invoicePayPanel = form.querySelector(".js-agenda-invoice-pay-panel");
    const invoicePaymentAmount = form.querySelector(".js-agenda-invoice-payment-amount");
    const invoicePaymentDue = form.querySelector(".js-agenda-invoice-payment-due");
    const invoicePaymentButtons = Array.from(form.querySelectorAll(".js-agenda-invoice-payment-method"));
    const invoicePaymentList = form.querySelector(".js-agenda-invoice-payment-list");
    const invoicePaymentComplete = form.querySelector(".js-agenda-invoice-payment-complete");
    const invoicePaymentReset = form.querySelector(".js-agenda-invoice-payment-reset");
    const invoiceLoyaltyOpen = form.querySelector(".js-agenda-invoice-loyalty-open");
    const invoiceDetailOpen = form.querySelector(".js-agenda-invoice-detail-open");
    const invoiceDetailModal = form.querySelector(".js-agenda-invoice-detail-modal");
    const invoiceDetailClose = form.querySelector(".js-agenda-invoice-detail-close");
    const invoiceDetailCancel = form.querySelector(".js-agenda-invoice-detail-cancel");
    const invoiceDetailSave = form.querySelector(".js-agenda-invoice-detail-save");
    const invoiceMoreToggle = form.querySelector(".js-agenda-invoice-more-toggle");
    const invoiceMoreMenu = form.querySelector(".js-agenda-invoice-more-menu");
    const invoiceMarkUnpaid = form.querySelector(".js-agenda-invoice-mark-unpaid");
    const invoiceReschedule = form.querySelector(".js-agenda-invoice-reschedule");
    const invoiceVoid = form.querySelector(".js-agenda-invoice-void");
    const paymentDetailOpen = form.querySelector(".js-agenda-payment-detail-open");
    const paymentDetailModal = form.querySelector(".js-agenda-payment-detail-modal");
    const paymentDetailClose = form.querySelector(".js-agenda-payment-detail-close");
    const paymentDetailCancel = form.querySelector(".js-agenda-payment-detail-cancel");
    const paymentDetailSave = form.querySelector(".js-agenda-payment-detail-save");
    const voidInvoiceModal = form.querySelector(".js-agenda-void-invoice-modal");
    const voidInvoiceClose = form.querySelector(".js-agenda-void-invoice-close");
    const voidInvoiceCancel = form.querySelector(".js-agenda-void-invoice-cancel");
    const voidInvoiceConfirm = form.querySelector(".js-agenda-void-invoice-confirm");
    const voucherDrawer = form.querySelector(".js-agenda-voucher-drawer");
    const voucherClose = form.querySelector(".js-agenda-voucher-close");
    const voucherSearchInput = form.querySelector(".js-agenda-voucher-search");
    const voucherList = form.querySelector(".js-agenda-voucher-list");
    const voucherEmpty = form.querySelector(".js-agenda-voucher-empty");
    const loyaltyDrawer = form.querySelector(".js-agenda-loyalty-drawer");
    const loyaltyClose = form.querySelector(".js-agenda-loyalty-close");
    const checkoutItemPickerOpen = form.querySelector(".js-checkout-item-picker-open");
    const closeRequest = form.querySelector(".js-agenda-close-request");
    const exitConfirm = form.querySelector(".js-agenda-exit-confirm");
    const exitCancel = form.querySelector(".js-agenda-exit-cancel");
    const exitConfirmed = form.querySelector(".js-agenda-exit-confirmed");
    const customerSearch = form.querySelector(".js-agenda-customer-search");
    const customerEmpty = form.querySelector(".js-agenda-customer-empty");
    const customerCard = form.querySelector(".js-agenda-customer-card");
    const customerDisplay = form.querySelector(".js-agenda-customer-display");
    const customerTag = form.querySelector(".js-agenda-customer-tag");
    const customerNameInput = form.querySelector(".js-agenda-customer-name");
    const customerPhoneInput = form.querySelector(".js-agenda-customer-phone");
    const customerMenuToggle = form.querySelector(".js-agenda-customer-menu-toggle");
    const customerMenu = form.querySelector(".js-agenda-customer-menu");
    const customerRemove = form.querySelector(".js-agenda-customer-remove");
    const customerBack = form.querySelector(".js-agenda-customer-back");
    const customerRows = Array.from(form.querySelectorAll(".js-agenda-customer-row"));
    const branchInput = form.querySelector(".js-agenda-branch-input");
    const branchToggle = form.querySelector(".js-agenda-branch-toggle");
    const branchLabel = form.querySelector(".js-agenda-branch-label");
    const branchMenu = form.querySelector(".js-agenda-branch-menu");
    const branchOptions = Array.from(form.querySelectorAll(".js-agenda-branch-option"));
    const dateInput = form.querySelector(".js-calendar-date-input");
    const agendaDateOpen = form.querySelector(".js-agenda-date-open");
    const agendaDateLabel = form.querySelector(".js-agenda-date-label");
    const agendaDateOpenSecondary = form.querySelector(".js-agenda-date-open-secondary");
    const agendaDateLabelSecondary = form.querySelector(".js-agenda-date-label-secondary");
    const agendaDatePicker = form.querySelector(".js-agenda-date-picker");
    const timeInput = form.querySelector(".js-calendar-time-input");
    const toolBackdrop = form.querySelector(".js-agenda-tool-backdrop");
    const sharedTimeOpen = form.querySelector(".js-agenda-shared-time-open");
    const sharedTimeDialog = form.querySelector(".js-agenda-shared-time-dialog");
    const sharedTimeToggle = form.querySelector(".js-agenda-shared-time-toggle");
    const sharedTimeDisplay = form.querySelector(".js-agenda-shared-time-display");
    const sharedTimeHours = form.querySelector(".js-agenda-shared-time-hours");
    const sharedTimeMinutes = form.querySelector(".js-agenda-shared-time-minutes");
    const sharedTimeServices = form.querySelector(".js-agenda-shared-time-services");
    const sharedTimeCancel = form.querySelector(".js-agenda-shared-time-cancel");
    const sharedTimeSave = form.querySelector(".js-agenda-shared-time-save");
    const itemDialog = form.querySelector(".js-agenda-item-dialog");
    const itemDialogTitle = form.querySelector(".js-agenda-item-title");
    const itemDialogSubtitle = form.querySelector(".js-agenda-item-subtitle");
    const itemDialogChoiceTitle = form.querySelector(".js-agenda-item-choice-title");
    const itemDialogChoiceMeta = form.querySelector(".js-agenda-item-choice-meta");
    const itemDialogPrice = form.querySelector(".js-agenda-item-price");
    const itemDialogQty = form.querySelector(".js-agenda-item-qty");
    const itemDialogMinus = form.querySelector(".js-agenda-item-minus");
    const itemDialogPlus = form.querySelector(".js-agenda-item-plus");
    const itemDialogCancel = form.querySelector(".js-agenda-item-cancel");
    const itemDialogAdd = form.querySelector(".js-agenda-item-add");
    const noteOpen = form.querySelector(".js-agenda-note-open");
    const notePanel = form.querySelector(".js-agenda-note-panel");
    const noteInput = form.querySelector(".js-agenda-note-input");
    const noteClose = form.querySelector(".js-agenda-note-close");
    const repeatOpen = form.querySelector(".js-agenda-repeat-open");
    const repeatDialog = form.querySelector(".js-agenda-repeat-dialog");
    const repeatSwitch = form.querySelector(".js-agenda-repeat-switch");
    const repeatToggle = form.querySelector(".js-agenda-repeat-toggle");
    const repeatEnabledInput = form.querySelector(".js-agenda-repeat-enabled-input");
    const repeatFrequencyInput = form.querySelector(".js-agenda-repeat-frequency-input");
    const repeatEndTypeInput = form.querySelector(".js-agenda-repeat-end-type-input");
    const repeatFrequency = form.querySelector(".js-agenda-repeat-frequency");
    const repeatEndTabs = Array.from(form.querySelectorAll(".js-agenda-repeat-end-tab"));
    const repeatCountRow = form.querySelector(".js-agenda-repeat-count-row");
    const repeatDateRow = form.querySelector(".js-agenda-repeat-date-row");
    const repeatDate = form.querySelector(".js-agenda-repeat-date");
    const repeatCancel = form.querySelector(".js-agenda-repeat-cancel");
    const repeatApply = form.querySelector(".js-agenda-repeat-apply");
    const selectedItems = [];
    const checkoutPendingItems = [];
    const checkoutPayments = [];
    const initialAgendaTime = timeInput?.value || "09:00";
    const initialAgendaDate = dateInput?.value || agendaDatePicker?.value || "";
    const initialBranchName = branchInput?.value || "Star Salon";
    let isReviewMode = false;
    let isCheckoutMode = false;
    let isInvoiceEditMode = false;
    let isInvoicePaymentMode = false;
    let isCheckoutCustomerSearch = false;
    let isCheckoutItemPicker = false;
    let pendingCheckoutService = null;
    let pendingCheckoutQty = 1;
    let pendingCheckoutTarget = "checkout";
    let paymentDraftAmount = 0;
    let isPaymentDraftDirty = false;
    let isCurrentInvoicePaid = false;
    let activeFilter = "all";
    let agendaEntryMode = "agenda";
    let activeSalesCatalog = "services";
    let activeSalesSubfilter = "all";
    let pendingSharedHour = 0;
    let pendingSharedMinute = 0;
    let isSharedTimePickerOpen = false;
    let useSharedStartTime = false;
    let repeatEndType = "after";

    const normalize = (value) => String(value || "").trim().toLowerCase();
    const isSalesMode = () => agendaEntryMode === "sales";
    const catalogItems = (key) => Array.isArray(salesCatalogs?.[key]) ? salesCatalogs[key] : [];
    const salesCatalogIndex = new Map();
    ["services", "packages", "products", "vouchers", "plans", "payable"].forEach((key) => {
        catalogItems(key).forEach((item) => {
            if (item?.id) {
                salesCatalogIndex.set(`${item.kind || key.slice(0, -1)}:${item.id}`, item);
            }
        });
    });
    const findSalesCatalogItem = (type, id) => salesCatalogIndex.get(`${type}:${id}`) || null;
    const salesTabLabel = (key) => ({
        services: "Services",
        packages: "Packages",
        products: "Products",
        vouchers: "Vouchers",
        plans: "Plans",
        payable: "Akan Dibayar",
    }[key] || "Items");
    const salesSubfilterOptions = (key) => {
        if (key === "services") {
            return [
                { value: "hair-cut", label: "Hair Cut" },
                { value: "hair-treatment", label: "Hair Treatment" },
                { value: "hair-coloring", label: "Hair Coloring" },
            ];
        }
        if (key === "packages") {
            return [{ value: "hair-cut", label: "Hair Cut" }];
        }
        if (key === "products") {
            return [{ value: "all", label: "Semua" }];
        }
        if (key === "vouchers") {
            return [
                { value: "gift", label: "Gift" },
                { value: "service", label: "Service" },
                { value: "class", label: "Class" },
            ];
        }
        return [];
    };
    const syncSalesSubfilterDefault = () => {
        const options = salesSubfilterOptions(activeSalesCatalog);
        activeSalesSubfilter = options[0]?.value || "all";
    };
    const salesCardSubtitle = (item) => {
        if (item.kind === "product") {
            return item.variant || "";
        }
        if (item.kind === "package") {
            return item.description || "";
        }
        return "";
    };
    const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;",
    }[char]));
    const formatDateLabel = (value) => {
        if (!value) {
            return "Pilih Hari";
        }
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };
    const formatAgendaPrice = (value) => `Rp ${new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 0,
    }).format(value || 0)}`;
    const formatAgendaPriceDecimal = (value) => `Rp ${new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value || 0)}`;
    const parseAgendaPriceInput = (value) => {
        const raw = String(value || "").replace(/[^\d,.-]/g, "").trim();
        if (!raw) {
            return 0;
        }

        let normalized = raw;
        if (raw.includes(",")) {
            normalized = raw.replace(/\./g, "").replace(",", ".");
        } else {
            normalized = raw.replace(/\./g, "");
        }

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    };
    const findAgendaDiscount = (discountId) => agendaDiscountOptions.find((discount) => String(discount.id) === String(discountId)) || null;
    const computeAgendaDiscountValue = (discount, subtotal) => {
        const safeSubtotal = Math.max(0, Number(subtotal || 0));
        if (!discount || safeSubtotal <= 0) {
            return 0;
        }

        if (discount.mode === "percent") {
            const percent = Math.max(0, Number(discount.amount || 0));
            const maxDiscount = Math.max(0, Number(discount.max_discount || 0));
            const rawDiscount = safeSubtotal * (percent / 100);
            const cappedDiscount = maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
            return Math.min(safeSubtotal, cappedDiscount);
        }

        return Math.min(safeSubtotal, Math.max(0, Number(discount.amount || 0)));
    };
    const formatAgendaDiscountOption = (discount) => {
        if (!discount) {
            return "Select";
        }

        const amountLabel = String(discount.amount_label || "").trim();
        return amountLabel ? `${discount.name} (${amountLabel})` : String(discount.name || "Diskon");
    };
    const normalizeVoucherServiceName = (value) => normalize(
        String(value || "")
            .replace(/\(\)/g, "")
            .replace(/\s*-\s*$/g, "")
            .replace(/\s+/g, " ")
    );
    const formatVoucherExpiryLabel = (value) => {
        if (!value) {
            return "";
        }
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };
    const activeVoucherCustomerName = () => normalize(customerNameInput?.value || "");
    const isVoucherApplied = (voucherId) => checkoutPayments.some((payment) => payment.voucherId === voucherId);
    const selectedServiceVoucherAmount = (voucher) => {
        const serviceNames = Array.isArray(voucher?.service_names) ? voucher.service_names : [];
        if (serviceNames.length === 0) {
            return 0;
        }

        const normalizedVoucherServices = serviceNames.map(normalizeVoucherServiceName);
        let remainingUse = Math.max(0, Number(voucher.remaining || 0));

        return selectedServices().filter((service) => service.itemType === "service").reduce((sum, service) => {
            if (remainingUse <= 0) {
                return sum;
            }

            const matched = normalizedVoucherServices.includes(normalizeVoucherServiceName(service.name));
            if (!matched) {
                return sum;
            }

            const quantity = Math.max(1, Number(service.qty || 1));
            const unitTotal = Number(service.total || 0) / quantity;
            const appliedQty = Math.min(quantity, remainingUse);
            remainingUse -= appliedQty;
            return sum + (unitTotal * appliedQty);
        }, 0);
    };
    const voucherPaymentAmount = (voucher) => {
        if (!voucher) {
            return 0;
        }

        if (voucher.type === "gift") {
            return Math.min(
                checkoutRemaining(),
                Math.max(0, Number(voucher.remaining_value || 0))
            );
        }

        return Math.min(checkoutRemaining(), selectedServiceVoucherAmount(voucher));
    };
    const getAvailableCustomerVouchers = () => {
        const customerName = activeVoucherCustomerName();
        if (!customerName || customerName === "walk-in") {
            return [];
        }

        const selectedServiceNames = selectedServices()
            .filter((service) => service.itemType === "service")
            .map((service) => normalizeVoucherServiceName(service.name));

        return agendaOwnedVouchers
            .filter((voucher) => normalize(voucher.owner) === customerName)
            .filter((voucher) => {
                if (voucher.type !== "service") {
                    return true;
                }
                const serviceNames = Array.isArray(voucher.service_names) ? voucher.service_names : [];
                return serviceNames.some((name) => selectedServiceNames.includes(normalizeVoucherServiceName(name)));
            });
    };
    const formatAgendaDateLabel = (value) => {
        const date = parseDateInput(value);
        if (!date || Number.isNaN(date.getTime())) {
            return value || "";
        }

        return date.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).replace(/^0/, "");
    };
    const syncAgendaTitle = () => {
        if (!agendaTitle) {
            return;
        }

        if (isCheckoutMode) {
            if (isSalesMode()) {
                agendaTitle.textContent = "Penjualan Baru";
                return;
            }
            agendaTitle.textContent = isInvoiceEditMode ? "Ubah Faktur" : "Checkout";
            return;
        }

        agendaTitle.textContent = isSalesMode() ? "Penjualan Baru" : "Agenda Baru";
    };
    const syncServiceSearchPlaceholder = () => {
        if (!serviceSearch) {
            return;
        }

        if (isCheckoutItemPicker || isSalesMode()) {
            serviceSearch.placeholder = "Tambahkan service, produk, atau voucher ke dalam penjualan";
            return;
        }

        serviceSearch.placeholder = "Cari service...";
    };
    const syncSalesCatalogTabs = () => {
        salesCatalogTabs.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.salesCatalog === activeSalesCatalog);
        });
    };
    const syncAgendaMode = () => {
        form.classList.toggle("is-sales-mode", isSalesMode());
        if (submitButton) {
            submitButton.hidden = isSalesMode();
        }
        if (agendaDatePicker?._flatpickr) {
            agendaDatePicker._flatpickr.set("maxDate", isSalesMode() && todayValue ? todayValue : null);
        }
        if (isSalesMode() && todayValue) {
            setAgendaDate(dateInput?.value || todayValue);
        }
        syncSalesCatalogTabs();
        syncServiceSearchPlaceholder();
        syncAgendaTitle();
        renderSalesSubfilters();
        renderSalesCatalog();
    };
    const renderSalesSubfilters = () => {
        if (!salesSubfilters) {
            return;
        }

        if (!isSalesMode()) {
            salesSubfilters.hidden = true;
            salesSubfilters.innerHTML = "";
            return;
        }

        const options = salesSubfilterOptions(activeSalesCatalog);
        salesSubfilters.hidden = false;
        if (options.length === 0) {
            salesSubfilters.innerHTML = '<div class="calendar-sales-subfilters__list"></div><button class="calendar-sales-subfilters__toggle" type="button" aria-label="Filter"><i class="bi bi-caret-down-fill"></i></button>';
            return;
        }

        salesSubfilters.innerHTML = `
            <div class="calendar-sales-subfilters__list">
                ${options.map((option) => `
                    <button class="calendar-sales-subfilter ${option.value === activeSalesSubfilter ? "is-active" : ""}" type="button" data-sales-subfilter="${escapeHtml(option.value)}">${escapeHtml(option.label)}</button>
                `).join("")}
            </div>
            <button class="calendar-sales-subfilters__toggle" type="button" aria-label="Filter"><i class="bi bi-caret-down-fill"></i></button>
        `;

        salesSubfilters.querySelectorAll("[data-sales-subfilter]").forEach((button) => {
            button.addEventListener("click", () => {
                activeSalesSubfilter = button.dataset.salesSubfilter || "all";
                renderSalesSubfilters();
                renderSalesCatalog();
            });
        });
    };
    const renderSalesCard = (item) => {
        const priceLabel = formatAgendaPriceDecimal(item.price || item.amount || 0);
        if (activeSalesCatalog === "payable") {
            return `
                <button class="calendar-sales-card" type="button">
                    <div class="calendar-sales-card__payable">
                        <span class="calendar-sales-card__payable-avatar" data-qty="${escapeHtml(String(item.qty || 1))}"><i class="bi bi-emoji-smile"></i></span>
                        <div class="calendar-sales-card__body">
                            <strong class="calendar-sales-card__payable-name">${escapeHtml(item.customer || "Walk-In")}</strong>
                            <div class="calendar-sales-card__payable-meta">${escapeHtml(item.date || "")}</div>
                            <div class="calendar-sales-card__payable-meta">${escapeHtml(priceLabel.replace(",00", ""))}</div>
                        </div>
                        <span class="calendar-sales-card__payable-badge">${escapeHtml(item.badge || "NEW")}</span>
                    </div>
                </button>
            `;
        }

        if (activeSalesCatalog === "packages") {
            return `
                <button class="calendar-sales-card is-clickable" type="button" data-sales-card-id="${escapeHtml(String(item.id))}" data-sales-card-type="package">
                    <div class="calendar-sales-card__package">
                        <span class="calendar-sales-card__media">
                            <span class="calendar-sales-card__package-dots"><span></span><span></span></span>
                        </span>
                        <span class="calendar-sales-card__body">
                            <strong>${escapeHtml(item.name || "Package")}</strong>
                            <small>${escapeHtml(item.description || "")}</small>
                            <span class="calendar-sales-card__meta">
                                <span>${escapeHtml(formatDurationLabel(item.duration || 0))}</span>
                                <span class="calendar-agenda-dot"></span>
                                <span>${escapeHtml(priceLabel)}</span>
                            </span>
                        </span>
                    </div>
                </button>
            `;
        }

        if (activeSalesCatalog === "products") {
            return `
                <button class="calendar-sales-card is-clickable" type="button" data-sales-card-id="${escapeHtml(String(item.id))}" data-sales-card-type="product">
                    <div class="calendar-sales-card__product">
                        <span class="calendar-sales-card__media"><i class="bi bi-bottle calendar-sales-card__product-icon"></i></span>
                        <span class="calendar-sales-card__body">
                            <strong>${escapeHtml(`${item.name || "Product"} (${item.variant || ""})`)}</strong>
                            <span class="calendar-sales-card__meta">
                                <span>${escapeHtml(priceLabel)}</span>
                                <span class="calendar-agenda-dot"></span>
                                <span>${escapeHtml(String(item.stock || 0))}</span>
                            </span>
                        </span>
                    </div>
                </button>
            `;
        }

        if (activeSalesCatalog === "vouchers") {
            const badgeClass = item.badge_color === "green"
                ? "calendar-sales-card__media calendar-sales-card__media--voucher-green"
                : "calendar-sales-card__media calendar-sales-card__media--voucher-yellow";
            return `
                <button class="calendar-sales-card is-clickable" type="button" data-sales-card-id="${escapeHtml(String(item.id))}" data-sales-card-type="voucher">
                    <div class="calendar-sales-card__voucher">
                        <span class="${badgeClass}">${escapeHtml(item.badge || "S")}</span>
                        <span class="calendar-sales-card__voucher-text">
                            <strong>${escapeHtml(item.name || "Voucher")}</strong>
                            <span>${escapeHtml(item.subtitle || "")}</span>
                        </span>
                    </div>
                </button>
            `;
        }

        return `
            <button class="calendar-sales-card is-clickable" type="button" data-sales-card-id="${escapeHtml(String(item.id))}" data-sales-card-type="service">
                <div class="calendar-sales-card__service">
                    <span class="calendar-sales-card__media">${escapeHtml(String(item.initials || "SV"))}</span>
                    <span class="calendar-sales-card__body">
                        <strong>${escapeHtml(item.name || "Service")}</strong>
                        <span class="calendar-sales-card__meta">
                            <span>${escapeHtml(formatDurationLabel(item.duration || 0))}</span>
                            <span class="calendar-agenda-dot"></span>
                            <span>${escapeHtml(priceLabel)}</span>
                            ${item.gender === "male" ? '<i class="bi bi-gender-male calendar-agenda-service__gender"></i>' : ""}
                            ${item.gender === "female" ? '<i class="bi bi-gender-female calendar-agenda-service__gender"></i>' : ""}
                        </span>
                    </span>
                </div>
            </button>
        `;
    };
    const renderSalesCatalog = () => {
        if (!salesGrid || !salesEmpty) {
            return;
        }

        if (!isSalesMode()) {
            salesGrid.hidden = true;
            salesEmpty.hidden = true;
            salesGrid.innerHTML = "";
            form.classList.remove("is-sales-empty-tab");
            return;
        }

        let items = catalogItems(activeSalesCatalog);
        if (activeSalesCatalog !== "payable" && activeSalesSubfilter !== "all") {
            items = items.filter((item) => item.category === activeSalesSubfilter);
        }

        const query = normalize(serviceSearch?.value);
        if (query) {
            items = items.filter((item) => normalize(`${item.name || ""} ${item.description || ""} ${item.variant || ""} ${item.brand || ""}`).includes(query));
        }

        const isEmpty = items.length === 0;
        form.classList.toggle("is-sales-empty-tab", isEmpty);
        salesGrid.hidden = isEmpty;
        salesEmpty.hidden = !isEmpty;

        if (isEmpty) {
            salesGrid.innerHTML = "";
            salesEmpty.innerHTML = activeSalesCatalog === "plans"
                ? '<div class="calendar-sales-card__no-result"><div><i class="bi bi-file-earmark-x"></i><strong>No Result</strong></div></div>'
                : `Belum ada item pada tab ${salesTabLabel(activeSalesCatalog)}.`;
            return;
        }

        salesEmpty.textContent = "";
        salesGrid.innerHTML = items.map(renderSalesCard).join("");

        salesGrid.querySelectorAll("[data-sales-card-id]").forEach((button) => {
            button.addEventListener("click", () => {
                const type = button.dataset.salesCardType || "service";
                const item = findSalesCatalogItem(type, button.dataset.salesCardId || "");
                if (!item) {
                    return;
                }

                if (type === "service" || type === "product") {
                    showItemDialog(item, "selected");
                    return;
                }

                selectedItems.push(createAgendaItem(item, {
                    checkoutExpanded: selectedItems.length === 0,
                }));
                updateSelectedServices();
            });
        });
    };

    const findAgendaSourceItem = (item) => {
        const itemType = item.itemType || "service";
        const itemId = item.itemId || item.serviceId;
        if (itemType === "service") {
            const card = serviceCards.find((serviceCard) => serviceCard.dataset.serviceId === itemId);
            if (card) {
                return {
                    id: card.dataset.serviceId,
                    kind: "service",
                    name: card.dataset.serviceName || "Layanan",
                    price: Number(card.dataset.servicePrice || 0),
                    duration: Number(card.dataset.serviceDuration || 60),
                    category: card.dataset.serviceCategory || "hair-cut",
                };
            }
        }

        return findSalesCatalogItem(itemType, itemId);
    };

    const servicesForItems = (items) => items.map((item) => {
        const itemId = item.itemId || item.serviceId;
        const source = findAgendaSourceItem(item);
        const fallbackDuration = Number(source?.duration || 60);
        const fallbackStaff = staffOptions[0] || { id: "", name: selectedStaffName() };
        const basePrice = Number(source?.price || 0);
        const qty = Math.max(1, Number(item.checkoutQty || 1));
        const unitPrice = Number.isFinite(Number(item.checkoutUnitPrice))
            ? Math.max(0, Number(item.checkoutUnitPrice))
            : basePrice;
        const originalTotal = basePrice * qty;
        const subtotal = unitPrice * qty;
        const selectedDiscount = findAgendaDiscount(item.checkoutDiscountId);
        const discount = selectedDiscount
            ? computeAgendaDiscountValue(selectedDiscount, subtotal)
            : Math.max(0, Number(item.checkoutDiscount || 0));

        return {
            instanceId: item.instanceId,
            id: itemId,
            itemType: item.itemType || source?.kind || "service",
            name: source?.name || item.name || "Layanan",
            price: basePrice,
            unitPrice,
            qty,
            discount,
            subtotal,
            originalTotal,
            total: Math.max(0, subtotal - discount),
            appliedDiscountId: selectedDiscount ? String(selectedDiscount.id) : "",
            appliedDiscountLabel: selectedDiscount ? formatAgendaDiscountOption(selectedDiscount) : "",
            duration: Number(item.duration || fallbackDuration),
            startTime: item.startTime || "",
            staffId: item.staffId || String(fallbackStaff.id || ""),
            staffName: item.itemType === "service" ? (item.staffName || fallbackStaff.name || selectedStaffName()) : "",
            resourceId: item.resourceId || "",
            resourceName: item.resourceName || "Select",
            checkoutExpanded: item.checkoutExpanded,
            subtitle: salesCardSubtitle(source || {}),
            stock: Number(source?.stock || 0),
        };
    });

    const selectedServices = () => servicesForItems(selectedItems);
    const checkoutPendingServices = () => servicesForItems(checkoutPendingItems);
    const activePickerItems = () => (isCheckoutItemPicker ? checkoutPendingItems : selectedItems);
    const activePickerServices = () => (isCheckoutItemPicker ? checkoutPendingServices() : selectedServices());
    const serviceCount = (serviceId) => activePickerItems().filter((item) => item.serviceId === serviceId).length;

    const syncServiceInputs = () => {
        if (!serviceInputContainer) {
            return;
        }

        serviceInputContainer.innerHTML = "";
        const agendaStart = timeInput?.value || "09:00";
        let nextStart = agendaStart;
        selectedServices().filter((service) => service.itemType === "service").forEach((service) => {
            const startTime = service.startTime || (useSharedStartTime ? agendaStart : nextStart);
            if (!useSharedStartTime) {
                nextStart = addMinutes(startTime, service.duration);
            }
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "service_ids[]";
            input.value = service.id;
            serviceInputContainer.append(input);

            [
                ["service_start_times[]", startTime],
                ["service_durations[]", String(service.duration)],
                ["service_staff_ids[]", service.staffId],
                ["service_resources[]", service.resourceId],
                ["service_quantities[]", String(service.qty || 1)],
                ["service_prices[]", String(service.unitPrice ?? service.price)],
                ["service_discounts[]", String(service.discount || 0)],
            ].forEach(([name, value]) => {
                const hidden = document.createElement("input");
                hidden.type = "hidden";
                hidden.name = name;
                hidden.value = value;
                serviceInputContainer.append(hidden);
            });
        });
    };

    const servicePayload = (card) => ({
        id: card.dataset.serviceId,
        kind: "service",
        name: card.dataset.serviceName || "Layanan",
        price: Number(card.dataset.servicePrice || 0),
        duration: Number(card.dataset.serviceDuration || 60),
        category: card.dataset.serviceCategory || "hair-cut",
    });

    const selectedSubtotal = () => selectedServices().reduce((sum, service) => sum + (service.subtotal ?? service.price), 0);
    const selectedDiscountAmount = () => selectedServices().reduce((sum, service) => sum + (service.discount || 0), 0);
    const selectedTotal = () => selectedServices().reduce((sum, service) => sum + (service.total ?? service.price), 0);
    const checkoutPendingTotal = () => checkoutPendingServices().reduce((sum, service) => sum + (service.total ?? service.price), 0);

    const selectedStaffName = () => {
        const staffInput = form.querySelector("[name='staff_id']");
        return staffInput?.selectedOptions?.[0]?.textContent?.trim() || "Rayhan Doni Pramana";
    };

    const staffHasWorkHours = (time) => {
        const parsed = parseAgendaTime(time);
        const totalMinutes = (parsed.hours * 60) + parsed.minutes;
        return totalMinutes >= 540 && totalMinutes < 1080;
    };

    const staffWorkWarningText = (staffName, time) => `${staffName || selectedStaffName()} tidak memiliki jam kerja pada pukul ${time}.`;

    const syncStaffWorkWarning = (warning, staffName, time) => {
        if (!warning) {
            return;
        }

        const hidden = staffHasWorkHours(time);
        warning.hidden = hidden;
        if (!hidden) {
            warning.textContent = staffWorkWarningText(staffName, time);
        }
    };

    const hourOptions = Array.from({ length: 24 }, (_, index) => index);
    const minuteOptions = Array.from({ length: 12 }, (_, index) => index * 5);
    const durationOptions = Array.from({ length: (23 * 12) + 11 }, (_, index) => (index + 1) * 5);

    const formatAgendaTime = (hours, minutes) => `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const formatDurationLabel = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours === 0) {
            return `${remainingMinutes}min`;
        }

        if (remainingMinutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${remainingMinutes}min`;
    };

    const parseAgendaTime = (value) => {
        const [rawHours, rawMinutes] = String(value || "09:00").split(":").map(Number);
        let hours = Number.isFinite(rawHours) ? rawHours : 9;
        let minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;

        hours = ((hours % 24) + 24) % 24;
        minutes = Math.round(minutes / 5) * 5;
        if (minutes >= 60) {
            hours = (hours + 1) % 24;
            minutes = 0;
        }

        return { hours, minutes };
    };

    const closeBranchMenu = () => {
        if (!branchMenu) {
            return;
        }

        branchMenu.hidden = true;
        branchToggle?.setAttribute("aria-expanded", "false");
    };

    const createAgendaItem = (service, options = {}) => ({
        instanceId: `${service.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        serviceId: service.id,
        itemId: service.id,
        itemType: service.kind || "service",
        name: service.name || "Layanan",
        duration: service.duration,
        staffId: String(staffOptions[0]?.id || ""),
        staffName: (service.kind || "service") === "service" ? (staffOptions[0]?.name || selectedStaffName()) : "",
        resourceId: "",
        resourceName: "Select",
        collapsed: false,
        checkoutExpanded: false,
        ...options,
    });

    const hideSharedTimeDialog = () => {
        if (toolBackdrop) {
            toolBackdrop.hidden = true;
        }
        if (sharedTimeDialog) {
            sharedTimeDialog.hidden = true;
            sharedTimeDialog.classList.remove("is-time-picker-open");
        }
        isSharedTimePickerOpen = false;
    };

    const hideRepeatDialog = () => {
        if (toolBackdrop) {
            toolBackdrop.hidden = true;
        }
        if (repeatDialog) {
            repeatDialog.hidden = true;
        }
    };

    const hideItemDialog = () => {
        if (itemDialog) {
            itemDialog.hidden = true;
        }
        if (toolBackdrop && sharedTimeDialog?.hidden && repeatDialog?.hidden) {
            toolBackdrop.hidden = true;
        }
        pendingCheckoutService = null;
        pendingCheckoutQty = 1;
        pendingCheckoutTarget = "checkout";
    };

    const closeAgendaTools = () => {
        closeBranchMenu();
        hideItemDialog();
        hideSharedTimeDialog();
        hideRepeatDialog();
    };

    const syncRepeatEndType = () => {
        repeatEndTabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.repeatEnd === repeatEndType);
        });
        if (repeatCountRow) {
            repeatCountRow.hidden = repeatEndType !== "after";
        }
        if (repeatDateRow) {
            repeatDateRow.hidden = repeatEndType !== "date";
        }
        if (repeatEndTypeInput) {
            repeatEndTypeInput.value = repeatEndType;
        }
    };

    const syncRepeatEnabled = () => {
        const enabled = !!repeatToggle?.checked;
        repeatDialog?.classList.toggle("is-enabled", enabled);
        repeatSwitch?.classList.toggle("is-checked", enabled);
        if (repeatEnabledInput) {
            repeatEnabledInput.value = enabled ? "1" : "0";
        }
    };

    const showRepeatDialog = () => {
        if (!repeatDialog || !toolBackdrop) {
            return;
        }

        closeBranchMenu();
        hideSharedTimeDialog();
        syncRepeatEnabled();
        syncRepeatEndType();
        toolBackdrop.hidden = false;
        repeatDialog.hidden = false;
    };

    const setAgendaDate = (value) => {
        let nextValue = value;
        if (isSalesMode() && todayValue && nextValue && nextValue > todayValue) {
            nextValue = todayValue;
        }
        if (dateInput) {
            dateInput.value = nextValue;
        }
        if (agendaDatePicker) {
            agendaDatePicker.value = nextValue;
        }
        if (agendaDateLabel) {
            agendaDateLabel.textContent = formatAgendaDateLabel(nextValue);
        }
        if (agendaDateLabelSecondary) {
            agendaDateLabelSecondary.textContent = formatAgendaDateLabel(nextValue);
        }
    };

    const renderTimeColumn = (container, label, values, selectedValue, onSelect) => {
        if (!container) {
            return;
        }

        container.innerHTML = `<div class="calendar-agenda-time-column__label">${label}</div>`;
        values.forEach((value) => {
            const button = document.createElement("button");
            button.className = "calendar-agenda-time-option";
            button.type = "button";
            button.textContent = String(value).padStart(2, "0");
            button.classList.toggle("is-active", value === selectedValue);
            button.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(value);
            });
            container.append(button);
        });

        container.querySelector(".calendar-agenda-time-option.is-active")?.scrollIntoView({
            block: "center",
        });
    };

    const renderSharedTimeServices = () => {
        if (!sharedTimeServices) {
            return;
        }

        const services = selectedServices();
        const selectedTime = formatAgendaTime(pendingSharedHour, pendingSharedMinute);
        sharedTimeServices.innerHTML = "";

        if (services.length === 0) {
            const empty = document.createElement("div");
            empty.className = "calendar-agenda-time-service";
            empty.innerHTML = "<span>Belum ada layanan</span><span>--:--</span>";
            sharedTimeServices.append(empty);
            return;
        }

        services.forEach((service) => {
            const row = document.createElement("div");
            row.className = "calendar-agenda-time-service";
            row.innerHTML = `<span>${escapeHtml(service.name)}</span><span>${selectedTime}</span>`;
            sharedTimeServices.append(row);
        });
    };

    const renderSharedTimeDialog = () => {
        const selectedTime = formatAgendaTime(pendingSharedHour, pendingSharedMinute);
        if (sharedTimeDisplay) {
            sharedTimeDisplay.textContent = selectedTime;
        }
        sharedTimeDialog?.classList.toggle("is-time-picker-open", isSharedTimePickerOpen);
        renderTimeColumn(sharedTimeHours, "HH", hourOptions, pendingSharedHour, (value) => {
            pendingSharedHour = value;
            renderSharedTimeDialog();
        });
        renderTimeColumn(sharedTimeMinutes, "mm", minuteOptions, pendingSharedMinute, (value) => {
            pendingSharedMinute = value;
            renderSharedTimeDialog();
        });
        renderSharedTimeServices();
    };

    const showSharedTimeDialog = () => {
        if (!sharedTimeDialog || !toolBackdrop) {
            return;
        }

        const parsedTime = parseAgendaTime(timeInput?.value || initialAgendaTime);
        pendingSharedHour = parsedTime.hours;
        pendingSharedMinute = parsedTime.minutes;
        isSharedTimePickerOpen = false;
        closeBranchMenu();
        hideRepeatDialog();
        reviewList?.querySelectorAll(".calendar-agenda-review-confirm").forEach((popover) => {
            popover.hidden = true;
        });
        toolBackdrop.hidden = false;
        sharedTimeDialog.hidden = false;
        renderSharedTimeDialog();
    };

    const positionReviewConfirm = (popover, trigger) => {
        if (!popover || !trigger) {
            return;
        }

        popover.hidden = false;
        popover.classList.remove("is-above", "is-below");

        const gap = 12;
        const margin = 14;
        const triggerRect = trigger.getBoundingClientRect();
        const popoverRect = popover.getBoundingClientRect();
        const maxLeft = window.innerWidth - popoverRect.width - margin;
        const left = Math.min(Math.max(triggerRect.left - popoverRect.width + triggerRect.width, margin), maxLeft);
        const aboveTop = triggerRect.top - popoverRect.height - gap;
        const belowTop = triggerRect.bottom + gap;
        const fitsAbove = aboveTop >= margin;
        const maxTop = window.innerHeight - popoverRect.height - margin;
        const top = fitsAbove ? aboveTop : Math.min(belowTop, maxTop);

        popover.style.left = `${left}px`;
        popover.style.top = `${Math.max(margin, top)}px`;
        popover.classList.add(fitsAbove ? "is-above" : "is-below");
    };

    const closeReviewDropdowns = (except = null) => {
        reviewList?.querySelectorAll(".calendar-agenda-review-popover").forEach((popover) => {
            if (popover !== except) {
                popover.hidden = true;
                popover.previousElementSibling?.classList.remove("is-open");
            }
        });
    };

    const renderInlineTimePicker = (container, selectedTime, onSelect) => {
        if (!container) {
            return;
        }

        const parsedTime = parseAgendaTime(selectedTime);
        let currentHour = parsedTime.hours;
        let currentMinute = parsedTime.minutes;
        const draw = () => {
            container.innerHTML = `
                <div class="calendar-agenda-time-picker" aria-label="Pilih jam mulai">
                    <div class="calendar-agenda-time-column" data-time-column="hour">
                        <div class="calendar-agenda-time-column__label">HH</div>
                    </div>
                    <div class="calendar-agenda-time-column" data-time-column="minute">
                        <div class="calendar-agenda-time-column__label">mm</div>
                    </div>
                </div>
            `;
            const hourColumn = container.querySelector("[data-time-column='hour']");
            const minuteColumn = container.querySelector("[data-time-column='minute']");
            renderTimeColumn(hourColumn, "HH", hourOptions, currentHour, (value) => {
                currentHour = value;
                onSelect(formatAgendaTime(currentHour, currentMinute));
                draw();
            });
            renderTimeColumn(minuteColumn, "mm", minuteOptions, currentMinute, (value) => {
                currentMinute = value;
                onSelect(formatAgendaTime(currentHour, currentMinute));
                draw();
            });
        };

        draw();
    };

    const openReviewDropdown = (button, popover) => {
        if (!popover || !button) {
            return;
        }

        const willOpen = popover.hidden;
        closeReviewDropdowns(popover);
        popover.hidden = !willOpen;
        button.classList.toggle("is-open", willOpen);
    };

    const renderSelectedRows = () => {
        if (!selectedRows) {
            return;
        }

        selectedRows.innerHTML = "";

        if (isCheckoutItemPicker) {
            const grouped = checkoutPendingServices().reduce((items, service) => {
                const existing = items.find((item) => item.id === service.id);
                if (existing) {
                    existing.qty += 1;
                    existing.price += service.price;
                    existing.instanceIds.push(service.instanceId);
                    return items;
                }
                items.push({
                    ...service,
                    qty: 1,
                    instanceIds: [service.instanceId],
                });
                return items;
            }, []);

            grouped.forEach((service) => {
                const row = document.createElement("div");
                row.className = "calendar-agenda-selected__row is-checkout-picker";

                const remove = document.createElement("button");
                remove.className = "calendar-agenda-selected__remove";
                remove.type = "button";
                remove.setAttribute("aria-label", `Hapus ${service.name}`);
                remove.innerHTML = '<i class="bi bi-x-lg"></i>';
                remove.addEventListener("click", () => {
                    for (let index = checkoutPendingItems.length - 1; index >= 0; index -= 1) {
                        if (checkoutPendingItems[index].serviceId === service.id) {
                            checkoutPendingItems.splice(index, 1);
                        }
                    }
                    updateSelectedServices();
                });

                const qty = document.createElement("span");
                qty.className = "calendar-agenda-selected__qty";
                qty.textContent = String(service.qty);

                const name = document.createElement("span");
                name.textContent = service.name;

                const price = document.createElement("strong");
                price.textContent = formatAgendaPriceDecimal(service.price);

                row.append(remove, qty, name, price);
                selectedRows.append(row);
            });
            return;
        }

        selectedServices().forEach((service) => {
            const row = document.createElement("div");
            row.className = "calendar-agenda-selected__row";

            const remove = document.createElement("button");
            remove.className = "calendar-agenda-selected__remove";
            remove.type = "button";
            remove.setAttribute("aria-label", `Hapus ${service.name}`);
            remove.innerHTML = '<i class="bi bi-x-lg"></i>';
            remove.addEventListener("click", () => {
                const itemIndex = selectedItems.findIndex((item) => item.instanceId === service.instanceId);
                if (itemIndex >= 0) {
                    selectedItems.splice(itemIndex, 1);
                }
                updateSelectedServices();
            });

            const name = document.createElement("span");
            name.textContent = service.name;

            const price = document.createElement("strong");
            price.textContent = formatAgendaPrice(service.price);

            row.append(remove, name, price);
            selectedRows.append(row);
        });
    };

    const checkoutPaidTotal = () => checkoutPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const checkoutRemaining = () => Math.max(0, selectedTotal() - checkoutPaidTotal());

    const paymentAmountInputs = [checkoutPaymentAmount, invoicePaymentAmount].filter(Boolean);
    const setPaymentAmountValue = (value) => {
        paymentAmountInputs.forEach((input) => {
            input.value = formatAgendaPriceDecimal(value);
        });
    };

    const renderPaymentList = (list) => {
        if (!list) {
            return;
        }

        list.innerHTML = "";
        checkoutPayments.forEach((payment) => {
            const row = document.createElement("div");
            row.className = "calendar-agenda-payment-row";
            row.innerHTML = `
                <button type="button" data-payment-remove="${escapeHtml(payment.id)}" aria-label="Hapus pembayaran ${escapeHtml(payment.method)}">
                    <i class="bi bi-x-lg"></i>
                </button>
                <span>${escapeHtml(payment.method)}</span>
                <strong>${formatAgendaPriceDecimal(payment.amount)}</strong>
            `;
            list.append(row);
        });

        list.querySelectorAll("[data-payment-remove]").forEach((button) => {
            button.addEventListener("click", () => {
                const paymentIndex = checkoutPayments.findIndex((payment) => payment.id === button.dataset.paymentRemove);
                if (paymentIndex >= 0) {
                    checkoutPayments.splice(paymentIndex, 1);
                }
                isPaymentDraftDirty = false;
                updateCheckoutTotalsDisplay();
            });
        });
    };

    const renderCheckoutPayments = () => {
        renderPaymentList(checkoutPaymentList);
        renderPaymentList(invoicePaymentList);
    };
    const renderVoucherDrawer = () => {
        if (!voucherList || !voucherEmpty) {
            return;
        }

        const query = normalize(voucherSearchInput?.value);
        const vouchers = getAvailableCustomerVouchers().filter((voucher) => {
            const serviceLabel = voucher.type === "service" ? String(voucher.service_label || "") : "";
            const haystack = normalize(`${voucher.name || ""} ${voucher.code || ""} ${serviceLabel}`);
            return !query || haystack.includes(query);
        });

        voucherList.innerHTML = "";

        vouchers.forEach((voucher) => {
            const exhausted = voucher.type === "gift"
                ? Math.max(0, Number(voucher.remaining_value || 0)) <= 0
                : Math.max(0, Number(voucher.remaining || 0)) <= 0;
            const alreadyApplied = isVoucherApplied(voucher.id);
            const amount = voucherPaymentAmount(voucher);
            const disabled = exhausted || alreadyApplied || amount <= 0;
            const card = document.createElement("button");
            const isGift = voucher.type === "gift";
            const titleClass = isGift
                ? "calendar-agenda-voucher-card__title calendar-agenda-voucher-card__title--gift"
                : "calendar-agenda-voucher-card__title";
            const ticketClass = isGift
                ? "calendar-agenda-voucher-ticket calendar-agenda-voucher-ticket--gift"
                : "calendar-agenda-voucher-ticket";
            const valueLabel = isGift
                ? `${formatAgendaPriceDecimal(voucher.remaining_value || 0).replace(",00", "")} Tersisa`
                : `${Math.max(0, Number(voucher.remaining || 0))}/${Math.max(0, Number(voucher.total || 0))}`;

            card.type = "button";
            card.className = `calendar-agenda-voucher-card${disabled ? " is-disabled" : ""}`;
            card.disabled = disabled;
            card.dataset.voucherId = voucher.id;
            card.innerHTML = `
                <div class="calendar-agenda-voucher-card__head">
                    <strong class="calendar-agenda-voucher-card__type">${escapeHtml(voucher.type_label || "Voucher")}</strong>
                    <span class="calendar-agenda-voucher-card__expiry">Berlaku hingga ${escapeHtml(formatVoucherExpiryLabel(voucher.expiry_date))}</span>
                </div>
                <div class="calendar-agenda-voucher-card__body">
                    <span class="${ticketClass}">${isGift ? "G" : "S"}</span>
                    <div class="calendar-agenda-voucher-card__content">
                        <p class="${titleClass}">${escapeHtml(voucher.name || "Voucher")}${isGift ? "" : ` (${escapeHtml(voucher.service_label || "")})`}</p>
                        <p class="calendar-agenda-voucher-card__value">${escapeHtml(valueLabel)}</p>
                    </div>
                </div>
                <div class="calendar-agenda-voucher-card__footer">${escapeHtml(voucher.location || "Star Salon")}</div>
            `;
            voucherList.append(card);
        });

        const shouldShowEmpty = vouchers.length === 0;
        const emptyTitle = voucherEmpty.querySelector("strong");
        if (emptyTitle) {
            emptyTitle.textContent = activeVoucherCustomerName() && activeVoucherCustomerName() !== "walk-in"
                ? "No Result"
                : "Pilih customer dulu";
        }
        voucherEmpty.hidden = !shouldShowEmpty;
        voucherList.hidden = shouldShowEmpty;

        voucherList.querySelectorAll("[data-voucher-id]").forEach((button) => {
            button.addEventListener("click", () => {
                const voucher = getAvailableCustomerVouchers().find((item) => item.id === button.dataset.voucherId);
                if (!voucher || isVoucherApplied(voucher.id)) {
                    return;
                }

                const amount = voucherPaymentAmount(voucher);
                if (!amount) {
                    return;
                }

                checkoutPayments.push({
                    id: `voucher-${voucher.id}-${Date.now()}`,
                    method: `VOUCHER - ${voucher.name}`,
                    amount,
                    voucherId: voucher.id,
                });
                isPaymentDraftDirty = false;
                if (voucherDrawer) {
                    voucherDrawer.hidden = true;
                }
                updateCheckoutTotalsDisplay();
                renderVoucherDrawer();
            });
        });
    };

    const closeCheckoutMoreMenu = () => {
        if (!checkoutMoreMenu || !checkoutMoreToggle) {
            return;
        }

        checkoutMoreMenu.hidden = true;
        checkoutMoreToggle.setAttribute("aria-expanded", "false");
    };

    const closeInvoiceMoreMenu = () => {
        if (!invoiceMoreMenu || !invoiceMoreToggle) {
            return;
        }

        invoiceMoreMenu.hidden = true;
        invoiceMoreToggle.setAttribute("aria-expanded", "false");
    };

    const hideLoyaltyDrawer = () => {
        if (loyaltyDrawer) {
            loyaltyDrawer.hidden = true;
        }
    };

    const showLoyaltyDrawer = () => {
        if (loyaltyDrawer) {
            loyaltyDrawer.hidden = false;
        }
    };

    const showInvoiceInfoPanel = () => {
        isInvoicePaymentMode = false;
        if (invoiceInfoPanel) {
            invoiceInfoPanel.hidden = false;
        }
        if (invoicePayPanel) {
            invoicePayPanel.hidden = true;
        }
        invoiceSide?.classList.remove("is-paying");
        hideLoyaltyDrawer();
    };

    const showInvoicePaymentPanel = () => {
        isInvoicePaymentMode = true;
        if (invoiceInfoPanel) {
            invoiceInfoPanel.hidden = true;
        }
        if (invoicePayPanel) {
            invoicePayPanel.hidden = false;
        }
        invoiceSide?.classList.add("is-paying");
        hideLoyaltyDrawer();
        updateCheckoutTotalsDisplay();
    };

    const hideInvoiceDetail = () => {
        if (invoiceDetailModal) {
            invoiceDetailModal.hidden = true;
        }
    };

    const hidePaymentDetail = () => {
        if (paymentDetailModal) {
            paymentDetailModal.hidden = true;
        }
    };

    const hideVoidInvoice = () => {
        if (voidInvoiceModal) {
            voidInvoiceModal.hidden = true;
        }
    };

    const invoiceShareUrl = () => {
        const baseUrl = window.location.href.split("#")[0];
        return `${baseUrl}#faktur-star-salon`;
    };

    const invoiceShareText = () => {
        const customerName = customerNameInput?.value?.trim() || "Walk-In";
        return `Faktur Star Salon untuk ${customerName} - ${formatAgendaPriceDecimal(checkoutRemaining())}`;
    };

    const invoicePlainText = () => {
        const services = selectedServices();
        const lines = services.map((service) => {
            const qty = service.qty || 1;
            const time = service.startTime || timeInput?.value || "00:00";
            return `${qty} ${service.name} | ${time} | ${service.staffName} | ${formatAgendaPriceDecimal(service.total)}`;
        });

        return [
            "Star Salon",
            "Faktur",
            `Customer: ${customerNameInput?.value?.trim() || "Walk-In"}`,
            ...lines,
            `Sub Total: ${formatAgendaPriceDecimal(selectedSubtotal())}`,
            `Diskon: ${formatAgendaPriceDecimal(selectedDiscountAmount())}`,
            `Total: ${formatAgendaPriceDecimal(selectedTotal())}`,
            `Sisa pembayaran: ${formatAgendaPriceDecimal(checkoutRemaining())}`,
        ].join("\n");
    };

    const setInvoiceFormat = (format = "receipt") => {
        const isA5 = format === "a5";
        if (invoiceReceipt) {
            invoiceReceipt.hidden = isA5;
        }
        if (invoiceA5) {
            invoiceA5.hidden = !isA5;
        }
        invoiceFormatButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.invoiceFormat === format);
        });
    };

    const renderInvoiceView = () => {
        const services = selectedServices();
        const subtotal = selectedSubtotal();
        const total = selectedTotal();
        const remaining = checkoutRemaining();
        const invoiceDateText = formatAgendaDateLabel(dateInput?.value || initialAgendaDate);
        const invoiceTimeText = timeInput?.value || "00:00";
        const isPaid = isCurrentInvoicePaid || (total > 0 && remaining <= 0);

        if (invoiceItems) {
            invoiceItems.innerHTML = services.map((service) => `
                <div class="calendar-agenda-invoice-line">
                    <span>${escapeHtml(String(service.qty || 1))}</span>
                    <span>
                        <strong>${escapeHtml(service.name)}</strong><br>
                        <small>${escapeHtml(service.startTime || timeInput?.value || "00:00")}<br>with ${escapeHtml(service.staffName)}</small>
                    </span>
                    <span>${formatAgendaPriceDecimal(service.total)}</span>
                </div>
            `).join("");
        }

        if (invoiceA5Items) {
            invoiceA5Items.innerHTML = services.map((service) => {
                const qty = service.qty || 1;
                const time = service.startTime || timeInput?.value || "00:00";
                const unitPrice = service.total / Math.max(qty, 1);

                return `
                    <tr>
                        <td>
                            <strong>${escapeHtml(service.name)}</strong><br>
                            <small>&bull; ${escapeHtml(time)}<br>&bull; with ${escapeHtml(service.staffName)}</small>
                        </td>
                        <td>${escapeHtml(String(qty))}</td>
                        <td>${formatAgendaPriceDecimal(unitPrice).replace("Rp ", "")}</td>
                        <td>${service.discount ? formatAgendaPriceDecimal(service.discount).replace("Rp ", "") : "0"}</td>
                        <td></td>
                        <td>${formatAgendaPriceDecimal(service.total).replace("Rp ", "")}</td>
                    </tr>
                `;
            }).join("");
        }

        [invoiceSubtotal, invoiceA5Subtotal].forEach((target) => {
            if (target) {
                target.textContent = formatAgendaPriceDecimal(subtotal);
            }
        });
        [invoiceTotal, invoiceGrandTotal, invoiceA5Total, invoiceA5GrandTotal].forEach((target) => {
            if (target) {
                target.textContent = formatAgendaPriceDecimal(total);
            }
        });
        if (invoiceRemaining) {
            invoiceRemaining.textContent = formatAgendaPriceDecimal(remaining);
        }
        if (invoiceA5Remaining) {
            invoiceA5Remaining.textContent = formatAgendaPriceDecimal(remaining);
        }
        if (invoiceCustomer) {
            invoiceCustomer.textContent = customerNameInput?.value?.trim() || "Walk-In";
        }
        if (invoiceStatus) {
            invoiceStatus.textContent = isPaid ? "PAID" : "UNPAID";
            invoiceStatus.classList.toggle("is-paid", isPaid);
        }
        if (invoiceMeta) {
            invoiceMeta.innerHTML = isPaid
                ? `
                    <div>Dibuat pada ${escapeHtml(`${invoiceDateText} ${invoiceTimeText}`)}</div>
                    <div>Dilunasi pada ${escapeHtml(`${invoiceDateText} ${invoiceTimeText}`)}</div>
                    <div>di ${escapeHtml(branchInput?.value || initialBranchName)} Oleh Rayhan Doni Pramana dari POINT OF SALE</div>
                `
                : `
                    <div>Dibuat pada ${escapeHtml(`${invoiceDateText} ${invoiceTimeText}`)}</div>
                    <div>Tanggal jatuh tempo faktur ${escapeHtml(invoiceDateText)}</div>
                    <div>di ${escapeHtml(branchInput?.value || initialBranchName)} Oleh Rayhan Doni Pramana dari POINT OF SALE</div>
                `;
        }
        if (invoicePayNow) {
            invoicePayNow.hidden = isPaid;
        }
        if (invoiceActions) {
            invoiceActions.classList.toggle("is-paid", isPaid);
        }
        const shareUrl = invoiceShareUrl();
        const shareText = `${invoiceShareText()}\n${shareUrl}`;
        if (invoiceEmail) {
            invoiceEmail.href = `mailto:?subject=${encodeURIComponent("Faktur Star Salon")}&body=${encodeURIComponent(shareText)}`;
        }
        if (invoiceWhatsapp) {
            invoiceWhatsapp.href = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        }
    };

    const showInvoiceView = () => {
        if (!invoiceView) {
            return;
        }

        closeCheckoutMoreMenu();
        closeInvoiceMoreMenu();
        renderInvoiceView();
        setInvoiceFormat("receipt");
        showInvoiceInfoPanel();
        invoiceView.hidden = false;
    };

    const hideInvoiceView = () => {
        if (invoiceView) {
            invoiceView.hidden = true;
        }
        closeInvoiceMoreMenu();
        hidePaymentDetail();
        hideVoidInvoice();
        hideLoyaltyDrawer();
    };

    const removeCheckoutItem = (instanceId) => {
        const itemIndex = selectedItems.findIndex((item) => item.instanceId === instanceId);
        if (itemIndex >= 0) {
            selectedItems.splice(itemIndex, 1);
        }

        if (selectedItems.length === 0) {
            isCheckoutMode = false;
            isCheckoutCustomerSearch = false;
            isCheckoutItemPicker = false;
            checkoutPendingItems.splice(0, checkoutPendingItems.length);
            checkoutPayments.splice(0, checkoutPayments.length);
            isPaymentDraftDirty = false;
            form.classList.remove("is-checkout-mode", "is-checkout-customer-search", "is-checkout-item-picker");
            if (checkoutLeft) {
                checkoutLeft.hidden = true;
            }
            if (checkoutPayment) {
                checkoutPayment.hidden = true;
            }
            if (agendaTitle) {
                agendaTitle.textContent = "Agenda Baru";
            }
            if (voucherDrawer) {
                voucherDrawer.hidden = true;
            }
            hideLoyaltyDrawer();
            closeCheckoutMoreMenu();
            hideInvoiceView();
            renderReviewRows();
        } else {
            renderCheckout();
        }
        updateSelectedServices();
    };

    const updateCheckoutTotalsDisplay = () => {
        const subtotal = selectedSubtotal();
        const discount = selectedDiscountAmount();
        const total = selectedTotal();
        const subtotalText = formatAgendaPriceDecimal(subtotal);
        const discountText = formatAgendaPriceDecimal(discount);
        const totalText = formatAgendaPriceDecimal(total);
        const paid = checkoutPaidTotal();
        const remaining = checkoutRemaining();
        const remainingText = formatAgendaPriceDecimal(remaining);
        const canPay = remaining > 0 && total > 0;

        if (checkoutBranch) {
            checkoutBranch.textContent = branchInput?.value || initialBranchName;
        }
        if (checkoutSubtotal) {
            checkoutSubtotal.textContent = subtotalText;
        }
        if (checkoutDiscountTotal) {
            checkoutDiscountTotal.textContent = discountText;
        }
        if (checkoutTotal) {
            checkoutTotal.textContent = totalText;
        }
        if (checkoutDue) {
            checkoutDue.textContent = `Sisa pembayaran ${remainingText}`;
        }
        if (paymentAmountInputs.length) {
            const activePaymentInput = paymentAmountInputs.includes(document.activeElement);
            if (!isPaymentDraftDirty || !activePaymentInput) {
                paymentDraftAmount = remaining;
                setPaymentAmountValue(remaining);
            }
        }
        if (checkoutPaymentAmount) {
            checkoutPaymentAmount.disabled = !canPay;
        }
        if (invoicePaymentAmount) {
            invoicePaymentAmount.disabled = !canPay;
        }
        if (checkoutPaymentDue) {
            checkoutPaymentDue.textContent = remainingText;
        }
        if (invoicePaymentDue) {
            invoicePaymentDue.textContent = remainingText;
        }
        checkoutPaymentButtons.forEach((button) => {
            button.disabled = !canPay;
        });
        invoicePaymentButtons.forEach((button) => {
            button.disabled = !canPay;
        });
        if (invoiceLoyaltyOpen) {
            invoiceLoyaltyOpen.disabled = !canPay;
        }
        if (checkoutPaymentComplete) {
            checkoutPaymentComplete.disabled = !(total > 0 && paid >= total);
        }
        if (invoicePaymentComplete) {
            invoicePaymentComplete.disabled = !(total > 0 && paid >= total);
        }
        renderCheckoutPayments();
        if (invoiceView && !invoiceView.hidden) {
            renderInvoiceView();
        }
    };

    const renderCheckoutPriceStack = (service) => {
        const totalText = formatAgendaPriceDecimal(service.total);
        const originalText = formatAgendaPriceDecimal(service.originalTotal);
        const hasPriceChange = Math.round(service.total) !== Math.round(service.originalTotal);

        return hasPriceChange
            ? `<span>${totalText}</span><del>${originalText}</del>`
            : `<span>${totalText}</span>`;
    };

    const renderCheckout = () => {
        const services = selectedServices();
        updateCheckoutTotalsDisplay();
        if (!checkoutList) {
            return;
        }

        checkoutList.innerHTML = "";
        if (services.length === 0) {
            checkoutList.innerHTML = '<div class="calendar-agenda-review-empty">Belum ada item checkout.</div>';
            return;
        }

        services.forEach((service, index) => {
            const card = document.createElement("div");
            const item = selectedItems.find((selectedItem) => selectedItem.instanceId === service.instanceId);
            const isExpanded = item?.checkoutExpanded ?? index === 0;
            const safeServiceName = escapeHtml(service.name);
            const priceText = formatAgendaPriceDecimal(service.total);
            const unitPriceText = formatAgendaPriceDecimal(service.unitPrice);
            const showStaffField = !["voucher", "gift"].includes(service.itemType);
            const detailLabel = service.itemType === "service"
                ? `${priceText} | dengan ${escapeHtml(service.staffName)}`
                : priceText;
            const avatarHtml = service.itemType === "product"
                ? '<i class="bi bi-bottle"></i>'
                : '<span></span>';
            const effectiveStaffOptions = staffOptions.length > 0
                ? staffOptions
                : [{ id: service.staffId || "", name: service.staffName || selectedStaffName() }];
            const staffOptionsHtml = effectiveStaffOptions.map((staff) => `
                <option value="${escapeHtml(staff.id)}" ${String(staff.id) === String(service.staffId) ? "selected" : ""}>${escapeHtml(staff.name)}</option>
            `).join("");
            const discountOptionsHtml = [
                `<option value="" ${service.appliedDiscountId ? "" : "selected"}>Select</option>`,
                ...agendaDiscountOptions.map((discount) => `
                    <option value="${escapeHtml(String(discount.id))}" ${String(discount.id) === String(service.appliedDiscountId || "") ? "selected" : ""}>
                        ${escapeHtml(formatAgendaDiscountOption(discount))}
                    </option>
                `),
            ].join("");
            card.className = `calendar-agenda-checkout-card ${isExpanded ? "is-expanded" : ""}`;
            card.innerHTML = `
                <span class="calendar-agenda-checkout-avatar">${avatarHtml}</span>
                <button class="calendar-agenda-checkout-main" type="button" data-checkout-toggle="${escapeHtml(service.instanceId)}" aria-label="Buka tutup ${safeServiceName}">
                    <strong>${safeServiceName}</strong>
                    <small>${detailLabel}</small>
                </button>
                <span class="calendar-agenda-checkout-price">${renderCheckoutPriceStack(service)}</span>
                <button class="calendar-agenda-checkout-remove" type="button" data-checkout-remove="${escapeHtml(service.instanceId)}" aria-label="Hapus ${safeServiceName}">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="calendar-agenda-checkout-confirm" hidden>
                    <p>Apakah anda yakin akan menghapus ini?</p>
                    <div class="calendar-agenda-checkout-confirm__actions">
                        <button class="calendar-agenda-checkout-confirm__cancel" type="button">Batal</button>
                        <button class="calendar-agenda-checkout-confirm__yes" type="button">Ya</button>
                    </div>
                </div>
                ${isExpanded ? `
                    <div class="calendar-agenda-checkout-fields">
                        <div class="calendar-agenda-checkout-field">
                            <label>Kuantitas</label>
                            <input class="calendar-agenda-checkout-control" type="number" min="1" step="1" inputmode="numeric" value="${service.qty}" data-checkout-qty="${escapeHtml(service.instanceId)}">
                        </div>
                        ${showStaffField ? `
                        <div class="calendar-agenda-checkout-field">
                            <label>Staff</label>
                            <select class="calendar-agenda-checkout-control" data-checkout-staff="${escapeHtml(service.instanceId)}">
                                ${staffOptionsHtml}
                            </select>
                        </div>
                        ` : ""}
                        <div class="calendar-agenda-checkout-field">
                            <label>Harga</label>
                            <input class="calendar-agenda-checkout-control" type="text" inputmode="numeric" value="${unitPriceText}" data-checkout-price="${escapeHtml(service.instanceId)}">
                        </div>
                        <div class="calendar-agenda-checkout-field calendar-agenda-checkout-discount-field">
                            <label>Diskon</label>
                            <select class="calendar-agenda-checkout-control ${service.appliedDiscountId ? "" : "is-muted"}" data-checkout-discount="${escapeHtml(service.instanceId)}">
                                ${discountOptionsHtml}
                            </select>
                        </div>
                    </div>
                ` : ""}
            `;
            checkoutList.append(card);
        });

        const refreshCheckoutCard = (card, item) => {
            const service = servicesForItems([item])[0];
            if (!service) {
                return;
            }

            const priceText = formatAgendaPriceDecimal(service.total);
            const mainSmall = card.querySelector(".calendar-agenda-checkout-main small");
            const priceStack = card.querySelector(".calendar-agenda-checkout-price");
            if (mainSmall) {
                mainSmall.innerHTML = service.itemType === "service"
                    ? `${priceText} | dengan ${escapeHtml(service.staffName)}`
                    : priceText;
            }
            if (priceStack) {
                priceStack.innerHTML = renderCheckoutPriceStack(service);
            }
            updateCheckoutTotalsDisplay();
            syncServiceInputs();
        };

        checkoutList.querySelectorAll("[data-checkout-toggle]").forEach((button) => {
            button.addEventListener("click", () => {
                const item = selectedItems.find((selectedItem) => selectedItem.instanceId === button.dataset.checkoutToggle);
                if (item) {
                    item.checkoutExpanded = !(item.checkoutExpanded ?? false);
                }
                renderCheckout();
            });
        });

        checkoutList.querySelectorAll("[data-checkout-remove]").forEach((button) => {
            const card = button.closest(".calendar-agenda-checkout-card");
            const confirm = card?.querySelector(".calendar-agenda-checkout-confirm");

            button.addEventListener("click", () => {
                checkoutList.querySelectorAll(".calendar-agenda-checkout-confirm").forEach((popover) => {
                    if (popover !== confirm) {
                        popover.hidden = true;
                    }
                });
                if (confirm) {
                    confirm.hidden = !confirm.hidden;
                }
            });

            card?.querySelector(".calendar-agenda-checkout-confirm__cancel")?.addEventListener("click", () => {
                if (confirm) {
                    confirm.hidden = true;
                }
            });

            card?.querySelector(".calendar-agenda-checkout-confirm__yes")?.addEventListener("click", () => {
                removeCheckoutItem(button.dataset.checkoutRemove || "");
            });
        });

        checkoutList.querySelectorAll("[data-checkout-qty]").forEach((input) => {
            input.addEventListener("input", () => {
                const item = selectedItems.find((selectedItem) => selectedItem.instanceId === input.dataset.checkoutQty);
                if (!item) {
                    return;
                }

                item.checkoutQty = Math.max(1, Number(input.value || 1));
                refreshCheckoutCard(input.closest(".calendar-agenda-checkout-card"), item);
            });
            input.addEventListener("change", () => {
                input.value = String(Math.max(1, Number(input.value || 1)));
            });
        });

        checkoutList.querySelectorAll("[data-checkout-staff]").forEach((select) => {
            select.addEventListener("change", () => {
                const item = selectedItems.find((selectedItem) => selectedItem.instanceId === select.dataset.checkoutStaff);
                const selectedOption = select.selectedOptions?.[0];
                if (!item || !selectedOption) {
                    return;
                }

                item.staffId = select.value || "";
                item.staffName = selectedOption.textContent?.trim() || selectedStaffName();
                refreshCheckoutCard(select.closest(".calendar-agenda-checkout-card"), item);
            });
        });

        checkoutList.querySelectorAll("[data-checkout-price]").forEach((input) => {
            const applyPrice = () => {
                const item = selectedItems.find((selectedItem) => selectedItem.instanceId === input.dataset.checkoutPrice);
                if (!item) {
                    return;
                }

                item.checkoutUnitPrice = parseAgendaPriceInput(input.value);
                refreshCheckoutCard(input.closest(".calendar-agenda-checkout-card"), item);
            };

            input.addEventListener("input", applyPrice);
            input.addEventListener("change", () => {
                applyPrice();
                const item = selectedItems.find((selectedItem) => selectedItem.instanceId === input.dataset.checkoutPrice);
                const service = item ? servicesForItems([item])[0] : null;
                if (service) {
                    input.value = formatAgendaPriceDecimal(service.unitPrice);
                }
            });
        });

        checkoutList.querySelectorAll("[data-checkout-discount]").forEach((select) => {
            const applyDiscount = () => {
                const item = selectedItems.find((selectedItem) => selectedItem.instanceId === select.dataset.checkoutDiscount);
                if (!item) {
                    return;
                }

                const selectedDiscount = findAgendaDiscount(select.value);
                item.checkoutDiscountId = selectedDiscount ? String(selectedDiscount.id) : "";
                item.checkoutDiscount = selectedDiscount
                    ? computeAgendaDiscountValue(selectedDiscount, Math.max(0, Number(item.checkoutUnitPrice || 0)) * Math.max(1, Number(item.checkoutQty || 1)))
                    : 0;
                select.classList.toggle("is-muted", !item.checkoutDiscountId);
                refreshCheckoutCard(select.closest(".calendar-agenda-checkout-card"), item);
            };

            select.addEventListener("change", applyDiscount);
        });
    };

    const updateSelectedServices = () => {
        const services = selectedServices();
        const pickerServices = activePickerServices();
        const count = pickerServices.length;
        const total = isCheckoutItemPicker ? checkoutPendingTotal() : selectedTotal();
        const cartCount = services.length;
        const cartTotal = selectedTotal();

        serviceCards.forEach((card) => {
            const countForCard = serviceCount(card.dataset.serviceId);
            card.classList.toggle("is-selected", countForCard > 0);
            card.dataset.selectedCount = String(countForCard);
        });

        syncServiceInputs();
        renderSelectedRows();
        selectedPanel?.classList.toggle("is-empty", count === 0);
        selectedPanel?.classList.toggle("is-checkout-picker", isCheckoutItemPicker);

        if (summary) {
            summary.textContent = (isCheckoutItemPicker || isSalesMode())
                ? `${count} items \u2022 ${formatAgendaPriceDecimal(total)}`
                : `${count} Layanan \u2022 ${formatAgendaPrice(total)}`;
        }

        if (footerAction) {
            footerAction.textContent = (isCheckoutItemPicker || isSalesMode())
                ? `Tambahkan ${count} items`
                : `Tambahkan ${count} Layanan`;
            footerAction.disabled = count === 0;
        }

        if (submitButton) {
            submitButton.disabled = !isReviewMode || cartCount === 0;
        }

        if (checkoutButton) {
            checkoutButton.disabled = !isReviewMode || cartCount === 0;
        }

        if (reviewTotal) {
            reviewTotal.textContent = `Jumlah total ${formatAgendaPrice(cartTotal)}`;
        }

        if (isCheckoutMode) {
            renderCheckout();
        }

        form.classList.toggle("is-empty-review", isReviewMode && count === 0);
        renderVoucherDrawer();
    };

    const renderReviewRows = () => {
        if (!reviewList) {
            return;
        }

        reviewList.innerHTML = "";

        if (selectedItems.length === 0) {
            const empty = document.createElement("div");
            empty.className = "calendar-agenda-review-empty";
            const startTime = form.querySelector("[name='time']")?.value || "09:00";
            empty.innerHTML = `
                <label>Jam mulai</label>
                <div class="calendar-agenda-review-empty__row">
                    <div class="calendar-agenda-review-box"><span><i class="bi bi-clock me-2"></i>${startTime}</span></div>
                    <button class="calendar-agenda-review-empty__add" type="button">Tambahkan Layanan</button>
                </div>
            `;
            empty.querySelector(".calendar-agenda-review-empty__add")?.addEventListener("click", () => {
                setReviewMode(false);
                serviceSearch?.focus();
            });
            reviewList.append(empty);
            return;
        }

        const agendaStart = timeInput?.value || "09:00";
        let nextStart = agendaStart;

        selectedServices().forEach((service, index) => {
            const card = document.createElement("div");
            card.className = "calendar-agenda-review-card";
            const item = selectedItems.find((selectedItem) => selectedItem.instanceId === service.instanceId);
            if (item?.collapsed) {
                card.classList.add("is-collapsed");
            }

            const durationLabel = formatDurationLabel(service.duration);
            const startTime = service.startTime || (useSharedStartTime ? agendaStart : nextStart);
            if (!useSharedStartTime) {
                nextStart = addMinutes(startTime, service.duration);
            }

            const safeServiceName = escapeHtml(service.name);
            const safeStaffName = escapeHtml(service.staffName);
            const safeResourceName = escapeHtml(service.resourceName);
            const warningText = escapeHtml(staffWorkWarningText(service.staffName, startTime));
            const warningHidden = staffHasWorkHours(startTime) ? "hidden" : "";
            const staffOptionsHtml = staffOptions.map((staff) => `
                <button class="calendar-agenda-review-option ${String(staff.id) === service.staffId ? "is-active" : ""}" type="button" data-staff-id="${escapeHtml(staff.id)}" data-staff-name="${escapeHtml(staff.name)}">${escapeHtml(staff.name)}</button>
            `).join("");
            const resourceOptionsHtml = resourceOptions.map((resource) => `
                <button class="calendar-agenda-review-option ${String(resource.id) === service.resourceId ? "is-active" : ""}" type="button" data-resource-id="${escapeHtml(resource.id)}" data-resource-name="${escapeHtml(resource.name)}">${escapeHtml(resource.name)}</button>
            `).join("");
            const durationOptionsHtml = durationOptions.map((minutes) => `
                <button class="calendar-agenda-review-option ${minutes === service.duration ? "is-active" : ""}" type="button" data-duration="${minutes}">${formatDurationLabel(minutes)}</button>
            `).join("");

            card.innerHTML = `
                <div class="calendar-agenda-review-card__head">
                    <button class="calendar-agenda-review-card__toggle" type="button" aria-label="Buka tutup ${safeServiceName}">
                        <span class="calendar-agenda-review-number">${index + 1}</span>
                        <div>
                            <strong>${safeServiceName}</strong>
                            <div class="calendar-agenda-review-card__meta">
                                <span>${durationLabel}</span>
                                <span class="calendar-agenda-dot"></span>
                                <span>${formatAgendaPrice(service.price)}</span>
                            </div>
                        </div>
                    </button>
                    <button class="calendar-agenda-review-remove" type="button" aria-label="Hapus ${service.name}">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
                <div class="calendar-agenda-review-confirm" hidden>
                    <p>Apakah anda yakin akan menghapus ini?</p>
                    <div class="calendar-agenda-review-confirm__actions">
                        <button class="calendar-agenda-review-confirm__cancel" type="button">Batal</button>
                        <button class="calendar-agenda-review-confirm__yes" type="button">Ya</button>
                    </div>
                </div>
                <div class="calendar-agenda-review-fields">
                    <div class="calendar-agenda-review-field">
                        <label>Jam mulai</label>
                        <button class="calendar-agenda-review-box js-agenda-row-time-toggle" type="button">
                            <span><i class="bi bi-clock me-2"></i><span class="js-agenda-row-time-value">${startTime}</span></span>
                        </button>
                        <div class="calendar-agenda-review-popover calendar-agenda-review-time-popover js-agenda-row-time-popover" hidden></div>
                    </div>
                    <div class="calendar-agenda-review-field">
                        <label>Durasi</label>
                        <button class="calendar-agenda-review-box js-agenda-row-duration-toggle" type="button">
                            <span class="js-agenda-row-duration-value">${durationLabel}</span>
                            <i class="bi bi-chevron-down text-muted"></i>
                        </button>
                        <div class="calendar-agenda-review-popover js-agenda-row-duration-popover" hidden>
                            <div class="calendar-agenda-review-options">${durationOptionsHtml}</div>
                        </div>
                    </div>
                    <div class="calendar-agenda-review-field">
                        <label>Staff</label>
                        <button class="calendar-agenda-review-box js-agenda-row-staff-toggle" type="button">
                            <span class="js-agenda-row-staff-value">${safeStaffName}</span>
                            <i class="bi bi-chevron-down text-muted"></i>
                        </button>
                        <div class="calendar-agenda-review-popover js-agenda-row-staff-popover" hidden>
                            <div class="calendar-agenda-review-options">${staffOptionsHtml}</div>
                        </div>
                    </div>
                    <div class="calendar-agenda-review-field">
                        <label>Sumberdaya</label>
                        <button class="calendar-agenda-review-box ${service.resourceId ? "" : "is-muted"} js-agenda-row-resource-toggle" type="button">
                            <span class="js-agenda-row-resource-value">${safeResourceName}</span>
                            <i class="bi bi-chevron-down"></i>
                        </button>
                        <div class="calendar-agenda-review-popover js-agenda-row-resource-popover" hidden>
                            <div class="calendar-agenda-review-options">${resourceOptionsHtml}</div>
                        </div>
                    </div>
                </div>
                <div class="calendar-agenda-review-warning js-agenda-row-warning" ${warningHidden}>${warningText}</div>
            `;

            card.querySelector(".calendar-agenda-review-card__toggle")?.addEventListener("click", () => {
                const selectedItem = selectedItems.find((candidate) => candidate.instanceId === service.instanceId);
                if (selectedItem) {
                    selectedItem.collapsed = !selectedItem.collapsed;
                }
                renderReviewRows();
            });

            const confirm = card.querySelector(".calendar-agenda-review-confirm");

            card.querySelector(".calendar-agenda-review-remove")?.addEventListener("click", (event) => {
                reviewList.querySelectorAll(".calendar-agenda-review-confirm").forEach((popover) => {
                    if (popover !== confirm) {
                        popover.hidden = true;
                    }
                });
                if (confirm) {
                    if (confirm.hidden) {
                        positionReviewConfirm(confirm, event.currentTarget);
                    } else {
                        confirm.hidden = true;
                    }
                }
            });

            card.querySelector(".calendar-agenda-review-confirm__cancel")?.addEventListener("click", () => {
                if (confirm) {
                    confirm.hidden = true;
                }
            });

            card.querySelector(".calendar-agenda-review-confirm__yes")?.addEventListener("click", () => {
                const itemIndex = selectedItems.findIndex((item) => item.instanceId === service.instanceId);
                if (itemIndex >= 0) {
                    selectedItems.splice(itemIndex, 1);
                }
                renderReviewRows();
                updateSelectedServices();
            });

            const rowItem = item;
            const timeToggle = card.querySelector(".js-agenda-row-time-toggle");
            const timePopover = card.querySelector(".js-agenda-row-time-popover");
            const timeValue = card.querySelector(".js-agenda-row-time-value");
            const staffWarning = card.querySelector(".js-agenda-row-warning");
            renderInlineTimePicker(timePopover, startTime, (value) => {
                if (rowItem) {
                    rowItem.startTime = value;
                    useSharedStartTime = false;
                }
                if (timeValue) {
                    timeValue.textContent = value;
                }
                syncStaffWorkWarning(staffWarning, rowItem?.staffName || service.staffName, value);
                updateSelectedServices();
            });
            timeToggle?.addEventListener("click", () => {
                openReviewDropdown(timeToggle, timePopover);
            });

            const durationToggle = card.querySelector(".js-agenda-row-duration-toggle");
            const durationPopover = card.querySelector(".js-agenda-row-duration-popover");
            durationToggle?.addEventListener("click", () => {
                openReviewDropdown(durationToggle, durationPopover);
            });
            durationPopover?.querySelectorAll("[data-duration]").forEach((option) => {
                option.addEventListener("click", () => {
                    if (rowItem) {
                        rowItem.duration = Number(option.dataset.duration || service.duration);
                    }
                    closeReviewDropdowns();
                    renderReviewRows();
                    updateSelectedServices();
                });
            });

            const staffToggle = card.querySelector(".js-agenda-row-staff-toggle");
            const staffPopover = card.querySelector(".js-agenda-row-staff-popover");
            const staffValue = card.querySelector(".js-agenda-row-staff-value");
            staffToggle?.addEventListener("click", () => {
                openReviewDropdown(staffToggle, staffPopover);
            });
            staffPopover?.querySelectorAll("[data-staff-id]").forEach((option) => {
                option.addEventListener("click", () => {
                    if (rowItem) {
                        rowItem.staffId = option.dataset.staffId || "";
                        rowItem.staffName = option.dataset.staffName || selectedStaffName();
                    }
                    if (staffValue) {
                        staffValue.textContent = option.dataset.staffName || selectedStaffName();
                    }
                    syncStaffWorkWarning(staffWarning, option.dataset.staffName || selectedStaffName(), timeValue?.textContent || startTime);
                    closeReviewDropdowns();
                    updateSelectedServices();
                });
            });

            const resourceToggle = card.querySelector(".js-agenda-row-resource-toggle");
            const resourcePopover = card.querySelector(".js-agenda-row-resource-popover");
            const resourceValue = card.querySelector(".js-agenda-row-resource-value");
            resourceToggle?.addEventListener("click", () => {
                openReviewDropdown(resourceToggle, resourcePopover);
            });
            resourcePopover?.querySelectorAll("[data-resource-id]").forEach((option) => {
                option.addEventListener("click", () => {
                    if (rowItem) {
                        rowItem.resourceId = option.dataset.resourceId || "";
                        rowItem.resourceName = option.dataset.resourceName || "Select";
                    }
                    if (resourceValue) {
                        resourceValue.textContent = option.dataset.resourceName || "Select";
                    }
                    resourceToggle?.classList.remove("is-muted");
                    closeReviewDropdowns();
                    updateSelectedServices();
                });
            });

            reviewList.append(card);
        });
    };

    const setReviewMode = (enabled) => {
        isReviewMode = enabled;
        form.classList.toggle("is-review-mode", isReviewMode);
        if (!isReviewMode && isCheckoutMode) {
            isCheckoutMode = false;
            isCheckoutCustomerSearch = false;
            isCheckoutItemPicker = false;
            checkoutPendingItems.splice(0, checkoutPendingItems.length);
            form.classList.remove("is-checkout-mode", "is-checkout-customer-search", "is-checkout-item-picker");
            if (checkoutLeft) {
                checkoutLeft.hidden = true;
            }
            if (checkoutPayment) {
                checkoutPayment.hidden = true;
            }
        }
        if (isReviewMode) {
            renderReviewRows();
        } else if (reviewList) {
            reviewList.innerHTML = "";
            if (notePanel) {
                notePanel.hidden = true;
            }
            closeAgendaTools();
        }
        updateSelectedServices();
        syncAgendaTitle();
    };

    const setCheckoutCustomerSearch = (enabled) => {
        isCheckoutCustomerSearch = isCheckoutMode && enabled;
        form.classList.toggle("is-checkout-customer-search", isCheckoutCustomerSearch);
        if (isCheckoutCustomerSearch && customerEmpty) {
            customerEmpty.hidden = false;
        }
        if (isCheckoutCustomerSearch && customerCard) {
            customerCard.hidden = true;
        }
        if (isCheckoutCustomerSearch) {
            filterCustomerRows();
        }
    };

    const setCheckoutItemPicker = (enabled) => {
        isCheckoutItemPicker = isCheckoutMode && enabled;
        form.classList.toggle("is-checkout-item-picker", isCheckoutItemPicker);
        if (isCheckoutItemPicker) {
            closeAgendaTools();
            if (serviceSearch) {
                serviceSearch.value = "";
                serviceSearch.focus();
            }
        } else if (serviceSearch) {
            serviceSearch.value = "";
        }
        syncServiceSearchPlaceholder();
        applyServiceFilters();
        updateSelectedServices();
    };

    const renderItemDialog = () => {
        if (!pendingCheckoutService) {
            return;
        }

        if (itemDialogTitle) {
            itemDialogTitle.textContent = pendingCheckoutService.name;
        }
        if (itemDialogSubtitle) {
            const subtitle = String(pendingCheckoutService.brand || "").trim();
            itemDialogSubtitle.hidden = !subtitle;
            itemDialogSubtitle.textContent = subtitle;
        }
        if (itemDialogChoiceTitle) {
            itemDialogChoiceTitle.textContent = pendingCheckoutService.kind === "product"
                ? String(pendingCheckoutService.variant || "Default")
                : `(${formatDurationLabel(pendingCheckoutService.duration)})`;
        }
        if (itemDialogChoiceMeta) {
            const meta = pendingCheckoutService.kind === "product"
                ? `Stok: ${Math.max(0, Number(pendingCheckoutService.stock || 0))}`
                : "";
            itemDialogChoiceMeta.hidden = !meta;
            itemDialogChoiceMeta.textContent = meta;
        }
        if (itemDialogPrice) {
            itemDialogPrice.textContent = formatAgendaPriceDecimal(pendingCheckoutService.price);
        }
        if (itemDialogQty) {
            itemDialogQty.textContent = String(pendingCheckoutQty);
        }
        if (itemDialogMinus) {
            itemDialogMinus.disabled = pendingCheckoutQty <= 1;
        }
    };

    const showItemDialog = (service, target = "checkout") => {
        if (!itemDialog || !toolBackdrop) {
            return;
        }

        closeBranchMenu();
        hideSharedTimeDialog();
        hideRepeatDialog();
        pendingCheckoutService = service;
        pendingCheckoutQty = 1;
        pendingCheckoutTarget = target;
        toolBackdrop.hidden = false;
        itemDialog.hidden = false;
        renderItemDialog();
    };

    const setCheckoutMode = (enabled) => {
        const wasCheckoutMode = isCheckoutMode;
        isCheckoutMode = enabled && selectedItems.length > 0;
        form.classList.toggle("is-checkout-mode", isCheckoutMode);
        if (!isCheckoutMode) {
            isInvoiceEditMode = false;
            setCheckoutCustomerSearch(false);
            setCheckoutItemPicker(false);
            checkoutPayments.splice(0, checkoutPayments.length);
            isPaymentDraftDirty = false;
            closeCheckoutMoreMenu();
            closeInvoiceMoreMenu();
            hideInvoiceView();
            hideInvoiceDetail();
            hidePaymentDetail();
            hideVoidInvoice();
            if (voucherDrawer) {
                voucherDrawer.hidden = true;
            }
            hideLoyaltyDrawer();
        }
        if (checkoutLeft) {
            checkoutLeft.hidden = !isCheckoutMode;
        }
        if (checkoutPayment) {
            checkoutPayment.hidden = !isCheckoutMode;
        }
        if (salesCartToolbar) {
            salesCartToolbar.hidden = !(isCheckoutMode && isSalesMode());
        }
        syncAgendaTitle();
        if (isCheckoutMode) {
            if (!wasCheckoutMode) {
                checkoutPayments.splice(0, checkoutPayments.length);
                isPaymentDraftDirty = false;
            }
            closeAgendaTools();
            closeReviewDropdowns();
            closeCheckoutMoreMenu();
            closeInvoiceMoreMenu();
            hideInvoiceView();
            hideInvoiceDetail();
            hidePaymentDetail();
            hideVoidInvoice();
            setCheckoutCustomerSearch(false);
            setCheckoutItemPicker(false);
            reviewList?.querySelectorAll(".calendar-agenda-review-confirm").forEach((popover) => {
                popover.hidden = true;
            });
            renderCheckout();
        }
        updateSelectedServices();
    };

    const applyServiceFilters = () => {
        if (isSalesMode()) {
            renderSalesCatalog();
            return;
        }
        const query = normalize(serviceSearch?.value);
        serviceCards.forEach((card) => {
            const matchesFilter = activeFilter === "all" || card.dataset.serviceCategory === activeFilter;
            const matchesSearch = !query || normalize(card.dataset.serviceName).includes(query);
            card.hidden = !(matchesFilter && matchesSearch);
        });
    };

    serviceCards.forEach((card) => {
        card.addEventListener("click", () => {
            const service = servicePayload(card);
            if (!service.id) {
                return;
            }

            if (isCheckoutItemPicker) {
                showItemDialog(service);
                return;
            }

            selectedItems.push(createAgendaItem(service, {
                checkoutExpanded: selectedItems.length === 0,
            }));
            if (isReviewMode) {
                renderReviewRows();
            }
            updateSelectedServices();
        });
    });

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.agendaFilter || "all";
            filterButtons.forEach((filterButton) => {
                filterButton.classList.toggle("is-active", filterButton === button);
            });
            applyServiceFilters();
        });
    });

    serviceSearch?.addEventListener("input", applyServiceFilters);

    if (agendaDatePicker?._flatpickr) {
        agendaDatePicker._flatpickr.set("onChange", (_selectedDates, dateStr) => {
            setAgendaDate(dateStr);
        });
    }

    agendaDatePicker?.addEventListener("change", () => {
        setAgendaDate(agendaDatePicker.value);
    });

    agendaDateOpen?.addEventListener("click", () => {
        closeAgendaTools();
        if (agendaDatePicker?._flatpickr) {
            agendaDatePicker._flatpickr.set("positionElement", agendaDateOpen);
        }
        agendaDatePicker?._flatpickr?.open();
        if (!agendaDatePicker?._flatpickr) {
            agendaDatePicker?.focus();
        }
    });

    agendaDateOpenSecondary?.addEventListener("click", () => {
        closeAgendaTools();
        if (agendaDatePicker?._flatpickr) {
            agendaDatePicker._flatpickr.set("positionElement", agendaDateOpenSecondary);
        }
        agendaDatePicker?._flatpickr?.open();
        if (!agendaDatePicker?._flatpickr) {
            agendaDatePicker?.focus();
        }
    });

    branchToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!branchMenu) {
            return;
        }

        hideSharedTimeDialog();
        hideRepeatDialog();
        branchMenu.hidden = !branchMenu.hidden;
        branchToggle.setAttribute("aria-expanded", branchMenu.hidden ? "false" : "true");
    });

    branchOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const branchName = option.dataset.branchName || "Star Salon";
            if (branchInput) {
                branchInput.value = branchName;
            }
            if (branchLabel) {
                branchLabel.textContent = branchName;
            }
            closeBranchMenu();
            if (isCheckoutMode) {
                renderCheckout();
            }
        });
    });

    document.addEventListener("click", (event) => {
        if (!branchMenu || branchMenu.hidden) {
            return;
        }

        const target = event.target;
        if (branchMenu.contains(target) || branchToggle?.contains(target)) {
            return;
        }

        closeBranchMenu();
    });

    sharedTimeOpen?.addEventListener("click", showSharedTimeDialog);

    noteOpen?.addEventListener("click", () => {
        closeAgendaTools();
        if (notePanel) {
            notePanel.hidden = false;
            noteInput?.focus();
        }
    });

    noteClose?.addEventListener("click", () => {
        if (notePanel) {
            notePanel.hidden = true;
        }
    });

    sharedTimeToggle?.addEventListener("click", () => {
        isSharedTimePickerOpen = !isSharedTimePickerOpen;
        renderSharedTimeDialog();
    });

    sharedTimeCancel?.addEventListener("click", hideSharedTimeDialog);

    repeatOpen?.addEventListener("click", showRepeatDialog);

    repeatToggle?.addEventListener("change", syncRepeatEnabled);

    repeatFrequency?.addEventListener("change", () => {
        if (repeatFrequencyInput) {
            repeatFrequencyInput.value = repeatFrequency.value;
        }
    });

    repeatEndTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            repeatEndType = tab.dataset.repeatEnd || "after";
            syncRepeatEndType();
            if (repeatEndType === "date") {
                repeatDate?.focus();
                repeatDate?._flatpickr?.open();
            }
        });
    });

    repeatCancel?.addEventListener("click", hideRepeatDialog);

    repeatApply?.addEventListener("click", () => {
        syncRepeatEnabled();
        if (repeatFrequencyInput && repeatFrequency) {
            repeatFrequencyInput.value = repeatFrequency.value;
        }
        hideRepeatDialog();
    });

    toolBackdrop?.addEventListener("click", closeAgendaTools);

    sharedTimeSave?.addEventListener("click", () => {
        if (timeInput) {
            timeInput.value = formatAgendaTime(pendingSharedHour, pendingSharedMinute);
        }
        useSharedStartTime = true;
        hideSharedTimeDialog();
        renderReviewRows();
        updateSelectedServices();
    });

    footerAction?.addEventListener("click", () => {
        if (isCheckoutItemPicker) {
            checkoutPendingItems.forEach((item) => {
                selectedItems.push({
                    ...item,
                    instanceId: `${item.serviceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    checkoutExpanded: false,
                });
            });
            checkoutPendingItems.splice(0, checkoutPendingItems.length);
            setCheckoutItemPicker(false);
            renderCheckout();
            updateSelectedServices();
            return;
        }
        if (isSalesMode()) {
            isInvoiceEditMode = false;
            setCheckoutMode(true);
            return;
        }
        setReviewMode(true);
    });

    entryTriggers.forEach((trigger) => {
        trigger.addEventListener("click", () => {
            agendaEntryMode = trigger.dataset.entryMode === "sales" ? "sales" : "agenda";
            activeSalesCatalog = "services";
            syncSalesSubfilterDefault();
            syncAgendaMode();
        });
    });

    salesCatalogTabs.forEach((button) => {
        button.addEventListener("click", () => {
            activeSalesCatalog = button.dataset.salesCatalog || "services";
            syncSalesSubfilterDefault();
            syncAgendaMode();
            if (activeSalesCatalog === "payable" && selectedItems.length > 0) {
                setCheckoutMode(true);
                return;
            }
            if (isCheckoutMode) {
                setCheckoutMode(false);
            } else {
                updateSelectedServices();
            }
        });
    });

    checkoutButton?.addEventListener("click", () => {
        isInvoiceEditMode = false;
        setCheckoutMode(true);
    });

    paymentAmountInputs.forEach((input) => {
        input.addEventListener("focus", () => {
            input.select();
        });

        input.addEventListener("input", () => {
            paymentDraftAmount = parseAgendaPriceInput(input.value);
            isPaymentDraftDirty = true;
        });

        input.addEventListener("change", () => {
            const remaining = checkoutRemaining();
            paymentDraftAmount = Math.min(Math.max(0, parseAgendaPriceInput(input.value)), remaining);
            isPaymentDraftDirty = true;
            setPaymentAmountValue(paymentDraftAmount);
        });
    });

    const addPayment = (method) => {
        if (method === "VOUCHER") {
            if (voucherDrawer) {
                renderVoucherDrawer();
                voucherDrawer.hidden = false;
            }
            voucherSearchInput?.focus();
            return;
        }

        const remaining = checkoutRemaining();
        const amount = Math.min(Math.max(0, paymentDraftAmount || remaining), remaining);
        if (!amount) {
            return;
        }

        checkoutPayments.push({
            id: `${method}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            method,
            amount,
        });
        isPaymentDraftDirty = false;
        updateCheckoutTotalsDisplay();
    };

    const finishInvoicePayment = () => {
        if (checkoutRemaining() > 0 || selectedTotal() <= 0) {
            return;
        }

        const paidInvoice = {
            invoice: "11",
            customer: customerNameInput?.value?.trim() || "Walk-In",
            date: formatAgendaDateLabel(dateInput?.value || initialAgendaDate),
            time: timeInput?.value || "00:00",
            location: branchInput?.value || initialBranchName,
            tips: "0,00",
            gross: selectedTotal(),
            status: "PAID",
            paymentMethod: checkoutPayments[0]?.method || "CASH",
            paidAt: formatAgendaDateLabel(dateInput?.value || initialAgendaDate),
            items: selectedServices().map((service) => ({
                name: service.name,
                qty: service.qty || 1,
                price: Number(service.total || service.price || 0),
                staff: service.staffName || "Rayhan Doni Pramana",
                time: service.startTime || timeInput?.value || "00:00",
            })),
        };
        try {
            window.localStorage.setItem("starSalonLastPaidInvoice", JSON.stringify(paidInvoice));
        } catch (error) {
            // Local storage may be disabled; still show the invoice view.
        }
        isCurrentInvoicePaid = true;
        showInvoiceView();
    };

    [...checkoutPaymentButtons, ...invoicePaymentButtons].forEach((button) => {
        button.addEventListener("click", () => addPayment(button.dataset.paymentMethod || ""));
    });

    form.addEventListener("keydown", (event) => {
        if (!isCheckoutMode || event.key !== "Enter") {
            return;
        }

        if (event.target instanceof HTMLTextAreaElement) {
            return;
        }

        event.preventDefault();
    });

    checkoutMoreToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!checkoutMoreMenu) {
            return;
        }

        checkoutMoreMenu.hidden = !checkoutMoreMenu.hidden;
        checkoutMoreToggle.setAttribute("aria-expanded", checkoutMoreMenu.hidden ? "false" : "true");
    });

    checkoutViewInvoice?.addEventListener("click", () => {
        showInvoiceView();
    });

    invoiceViewClose?.addEventListener("click", () => {
        hideInvoiceView();
    });

    invoicePayNow?.addEventListener("click", () => {
        showInvoicePaymentPanel();
    });

    invoiceLoyaltyOpen?.addEventListener("click", showLoyaltyDrawer);
    loyaltyClose?.addEventListener("click", hideLoyaltyDrawer);

    invoicePaymentReset?.addEventListener("click", () => {
        checkoutPayments.splice(0, checkoutPayments.length);
        isPaymentDraftDirty = false;
        updateCheckoutTotalsDisplay();
    });

    checkoutPaymentComplete?.addEventListener("click", finishInvoicePayment);
    invoicePaymentComplete?.addEventListener("click", finishInvoicePayment);

    invoiceFormatButtons.forEach((button) => {
        button.addEventListener("click", () => {
            setInvoiceFormat(button.dataset.invoiceFormat || "receipt");
        });
    });

    invoiceDownload?.addEventListener("click", () => {
        const blob = new Blob([invoicePlainText()], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = "faktur-star-salon.txt";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });

    invoicePrint?.addEventListener("click", () => {
        window.print();
    });

    invoiceCopyLink?.addEventListener("click", () => {
        const text = `${invoiceShareText()}\n${invoiceShareUrl()}`;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => undefined);
        }
    });

    invoiceMoreToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!invoiceMoreMenu) {
            return;
        }

        invoiceMoreMenu.hidden = !invoiceMoreMenu.hidden;
        invoiceMoreToggle.setAttribute("aria-expanded", invoiceMoreMenu.hidden ? "false" : "true");
    });

    invoiceReschedule?.addEventListener("click", () => {
        closeInvoiceMoreMenu();
        hideInvoiceView();
        setCheckoutMode(false);
    });

    invoiceMarkUnpaid?.addEventListener("click", () => {
        closeInvoiceMoreMenu();
        hideInvoiceView();
        checkoutPayments.splice(0, checkoutPayments.length);
        isPaymentDraftDirty = false;
        isCurrentInvoicePaid = false;
        isInvoiceEditMode = true;
        setCheckoutMode(true);
    });

    invoiceVoid?.addEventListener("click", () => {
        closeInvoiceMoreMenu();
        if (voidInvoiceModal) {
            voidInvoiceModal.hidden = false;
        }
    });

    paymentDetailOpen?.addEventListener("click", () => {
        closeInvoiceMoreMenu();
        if (paymentDetailModal) {
            paymentDetailModal.hidden = false;
        }
    });

    invoiceDetailOpen?.addEventListener("click", () => {
        closeCheckoutMoreMenu();
        if (invoiceDetailModal) {
            invoiceDetailModal.hidden = false;
        }
    });

    invoiceDetailClose?.addEventListener("click", hideInvoiceDetail);
    invoiceDetailCancel?.addEventListener("click", hideInvoiceDetail);
    invoiceDetailSave?.addEventListener("click", hideInvoiceDetail);

    invoiceDetailModal?.addEventListener("click", (event) => {
        if (event.target === invoiceDetailModal) {
            hideInvoiceDetail();
        }
    });

    paymentDetailClose?.addEventListener("click", hidePaymentDetail);
    paymentDetailCancel?.addEventListener("click", hidePaymentDetail);
    paymentDetailSave?.addEventListener("click", hidePaymentDetail);

    paymentDetailModal?.addEventListener("click", (event) => {
        if (event.target === paymentDetailModal) {
            hidePaymentDetail();
        }
    });

    voidInvoiceClose?.addEventListener("click", hideVoidInvoice);
    voidInvoiceCancel?.addEventListener("click", hideVoidInvoice);
    voidInvoiceConfirm?.addEventListener("click", hideVoidInvoice);

    voidInvoiceModal?.addEventListener("click", (event) => {
        if (event.target === voidInvoiceModal) {
            hideVoidInvoice();
        }
    });

    voucherClose?.addEventListener("click", () => {
        if (voucherDrawer) {
            voucherDrawer.hidden = true;
        }
        if (voucherSearchInput) {
            voucherSearchInput.value = "";
        }
    });

    voucherDrawer?.addEventListener("click", (event) => {
        if (event.target === voucherDrawer) {
            voucherDrawer.hidden = true;
            if (voucherSearchInput) {
                voucherSearchInput.value = "";
            }
        }
    });

    voucherSearchInput?.addEventListener("input", () => {
        renderVoucherDrawer();
    });

    checkoutItemPickerOpen?.addEventListener("click", () => {
        checkoutPendingItems.splice(0, checkoutPendingItems.length);
        if (isSalesMode()) {
            activeSalesCatalog = "services";
            syncSalesSubfilterDefault();
            syncAgendaMode();
        }
        setCheckoutItemPicker(true);
    });

    pickerBack?.addEventListener("click", (event) => {
        if (!isCheckoutItemPicker) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        checkoutPendingItems.splice(0, checkoutPendingItems.length);
        setCheckoutItemPicker(false);
    }, true);

    itemDialogMinus?.addEventListener("click", () => {
        pendingCheckoutQty = Math.max(1, pendingCheckoutQty - 1);
        renderItemDialog();
    });

    itemDialogPlus?.addEventListener("click", () => {
        pendingCheckoutQty += 1;
        renderItemDialog();
    });

    itemDialogCancel?.addEventListener("click", hideItemDialog);

    itemDialogAdd?.addEventListener("click", () => {
        if (!pendingCheckoutService) {
            hideItemDialog();
            return;
        }

        Array.from({ length: pendingCheckoutQty }).forEach(() => {
            const nextItem = createAgendaItem(pendingCheckoutService, {
                checkoutExpanded: selectedItems.length === 0 && pendingCheckoutTarget === "selected",
            });
            if (pendingCheckoutTarget === "selected") {
                selectedItems.push(nextItem);
            } else {
                checkoutPendingItems.push(nextItem);
            }
        });
        hideItemDialog();
        updateSelectedServices();
    });

    reviewAddService?.addEventListener("click", () => {
        setReviewMode(false);
        serviceSearch?.focus();
    });

    form.querySelectorAll(".js-agenda-checkout-discount, .js-agenda-checkout-tip").forEach((link) => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
        });
    });

    document.addEventListener("click", (event) => {
        if (!reviewList) {
            return;
        }

        const target = event.target;
        if (!target.closest(".calendar-agenda-checkout-discount-field")) {
            checkoutList?.querySelectorAll(".calendar-agenda-checkout-dropdown").forEach((menu) => {
                menu.hidden = true;
            });
        }

        if (!target.closest(".calendar-agenda-more-wrap")) {
            closeCheckoutMoreMenu();
        }

        if (!target.closest(".calendar-agenda-invoice-more-wrap")) {
            closeInvoiceMoreMenu();
        }

        if (
            !target.closest(".calendar-agenda-checkout-remove")
            && !target.closest(".calendar-agenda-checkout-confirm")
        ) {
            checkoutList?.querySelectorAll(".calendar-agenda-checkout-confirm").forEach((popover) => {
                popover.hidden = true;
            });
        }

        if (
            target.closest(".calendar-agenda-review-remove")
            || target.closest(".calendar-agenda-review-confirm")
            || target.closest(".calendar-agenda-review-popover")
            || target.closest(".calendar-agenda-review-box")
        ) {
            return;
        }

        reviewList.querySelectorAll(".calendar-agenda-review-confirm").forEach((popover) => {
            popover.hidden = true;
        });
        closeReviewDropdowns();
    });

    const setWalkInCustomer = () => {
        if (customerNameInput) {
            customerNameInput.value = "Walk-In";
        }
        if (customerPhoneInput) {
            customerPhoneInput.value = "";
        }
        if (customerSearch) {
            customerSearch.value = "";
        }
        if (customerEmpty) {
            customerEmpty.hidden = false;
        }
        if (customerCard) {
            customerCard.hidden = true;
        }
        if (customerMenu) {
            customerMenu.hidden = true;
        }
        customerMenuToggle?.setAttribute("aria-expanded", "false");
        customerRows.forEach((row) => row.classList.remove("is-active"));
        renderVoucherDrawer();
    };

    const setNamedCustomer = (name) => {
        const matchedCustomer = customers.find((customer) => normalize(customer.name) === normalize(name));
        const displayName = matchedCustomer?.name || name;
        const tags = Array.isArray(matchedCustomer?.tags) && matchedCustomer.tags.length > 0
            ? matchedCustomer.tags.join(", ")
            : "Customer";

        if (customerNameInput) {
            customerNameInput.value = displayName;
        }
        if (customerPhoneInput) {
            customerPhoneInput.value = matchedCustomer?.phone || "";
        }
        if (customerDisplay) {
            customerDisplay.textContent = displayName;
        }
        if (customerTag) {
            customerTag.textContent = tags;
        }
        if (customerEmpty) {
            customerEmpty.hidden = true;
        }
        if (customerCard) {
            customerCard.hidden = false;
        }
        if (customerMenu) {
            customerMenu.hidden = true;
        }
        customerMenuToggle?.setAttribute("aria-expanded", "false");
        customerRows.forEach((row) => {
            row.classList.toggle("is-active", normalize(row.dataset.customerName) === normalize(displayName));
        });
        if (isCheckoutMode) {
            setCheckoutCustomerSearch(false);
        }
        renderVoucherDrawer();
    };

    const filterCustomerRows = () => {
        const query = normalize(customerSearch?.value);
        customerRows.forEach((row) => {
            const haystack = normalize(`${row.dataset.customerName || ""} ${row.dataset.customerPhone || ""} ${row.dataset.customerTags || ""}`);
            row.hidden = !!query && !haystack.includes(query);
        });
    };

    customerSearch?.addEventListener("focus", () => {
        if (isCheckoutMode && !customerCard?.hidden) {
            return;
        }
        if (isCheckoutMode) {
            setCheckoutCustomerSearch(true);
        }
    });

    customerSearch?.addEventListener("click", () => {
        if (isCheckoutMode) {
            setCheckoutCustomerSearch(true);
        }
    });

    customerSearch?.addEventListener("input", () => {
        if (isCheckoutMode) {
            setCheckoutCustomerSearch(true);
        }
        filterCustomerRows();
    });

    customerSearch?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const firstVisibleCustomer = customerRows.find((row) => !row.hidden);
            if (firstVisibleCustomer) {
                setNamedCustomer(firstVisibleCustomer.dataset.customerName || "");
            }
        }
    });

    customerRows.forEach((row) => {
        row.addEventListener("click", () => {
            setNamedCustomer(row.dataset.customerName || "");
        });
    });

    customerBack?.addEventListener("click", () => {
        setWalkInCustomer();
        setCheckoutCustomerSearch(false);
        filterCustomerRows();
    });

    customerMenuToggle?.addEventListener("click", () => {
        if (!customerMenu) {
            return;
        }

        customerMenu.hidden = !customerMenu.hidden;
        customerMenuToggle.setAttribute("aria-expanded", customerMenu.hidden ? "false" : "true");
    });

    customerRemove?.addEventListener("click", () => {
        setWalkInCustomer();
        customerSearch?.focus();
    });

    document.addEventListener("click", (event) => {
        if (!customerMenu || !customerMenuToggle || customerMenu.hidden) {
            return;
        }

        const target = event.target;
        if (customerMenu.contains(target) || customerMenuToggle.contains(target)) {
            return;
        }

        customerMenu.hidden = true;
        customerMenuToggle.setAttribute("aria-expanded", "false");
    });

    const hideExitConfirm = () => {
        if (exitConfirm) {
            exitConfirm.hidden = true;
        }
    };

    const showExitConfirm = () => {
        if (exitConfirm) {
            exitConfirm.hidden = false;
        }
    };

    const resetAgendaForm = () => {
        selectedItems.splice(0, selectedItems.length);
        checkoutPendingItems.splice(0, checkoutPendingItems.length);
        checkoutPayments.splice(0, checkoutPayments.length);
        isReviewMode = false;
        isCheckoutMode = false;
        isInvoiceEditMode = false;
        isInvoicePaymentMode = false;
        isCurrentInvoicePaid = false;
        isCheckoutCustomerSearch = false;
        isCheckoutItemPicker = false;
        activeFilter = "all";
        agendaEntryMode = "agenda";
        activeSalesCatalog = "services";
        activeSalesSubfilter = "all";
        useSharedStartTime = false;
        paymentDraftAmount = 0;
        isPaymentDraftDirty = false;
        form.classList.remove("is-review-mode", "is-checkout-mode", "is-checkout-customer-search", "is-checkout-item-picker", "is-sales-mode", "is-sales-empty-tab", "is-sales-payable-tab");
        if (checkoutLeft) {
            checkoutLeft.hidden = true;
        }
        if (checkoutPayment) {
            checkoutPayment.hidden = true;
        }
        if (checkoutList) {
            checkoutList.innerHTML = "";
        }
        if (checkoutPaymentList) {
            checkoutPaymentList.innerHTML = "";
        }
        if (invoicePaymentList) {
            invoicePaymentList.innerHTML = "";
        }
        if (voucherDrawer) {
            voucherDrawer.hidden = true;
        }
        hideLoyaltyDrawer();
        closeCheckoutMoreMenu();
        closeInvoiceMoreMenu();
        hideInvoiceView();
        hideInvoiceDetail();
        hidePaymentDetail();
        hideVoidInvoice();
        if (timeInput) {
            timeInput.value = initialAgendaTime;
        }
        setAgendaDate(initialAgendaDate);
        if (branchInput) {
            branchInput.value = initialBranchName;
        }
        if (branchLabel) {
            branchLabel.textContent = initialBranchName;
        }
        if (notePanel) {
            notePanel.hidden = true;
        }
        if (noteInput) {
            noteInput.value = "";
        }
        if (repeatToggle) {
            repeatToggle.checked = false;
        }
        if (repeatFrequency) {
            repeatFrequency.value = "daily";
        }
        repeatEndType = "after";
        syncRepeatEnabled();
        syncRepeatEndType();
        if (serviceSearch) {
            serviceSearch.value = "";
        }
        if (voucherSearchInput) {
            voucherSearchInput.value = "";
        }
        filterButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.agendaFilter === "all");
        });
        if (reviewList) {
            reviewList.innerHTML = "";
        }
        setWalkInCustomer();
        filterCustomerRows();
        syncAgendaMode();
        applyServiceFilters();
        updateSelectedServices();
        hideExitConfirm();
        closeAgendaTools();
    };

    closeRequest?.addEventListener("click", () => {
        showExitConfirm();
    });

    exitCancel?.addEventListener("click", () => {
        hideExitConfirm();
    });

    exitConfirm?.addEventListener("click", (event) => {
        if (event.target === exitConfirm) {
            hideExitConfirm();
        }
    });

    exitConfirmed?.addEventListener("click", () => {
        resetAgendaForm();
        if (typeof bootstrap !== "undefined") {
            bootstrap.Modal.getOrCreateInstance(form.closest(".modal")).hide();
        }
    });

    form.closest(".modal")?.addEventListener("hidden.bs.modal", () => {
        resetAgendaForm();
    });

    syncRepeatEnabled();
    syncRepeatEndType();
    setWalkInCustomer();
    syncAgendaMode();
    updateSelectedServices();
    applyServiceFilters();
}

function initSalesTabs() {
    const shell = document.querySelector(".js-sales-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".sales-tab"));
    const panels = Array.from(shell.querySelectorAll(".sales-panel"));
    const fab = shell.querySelector(".js-sales-fab");
    const fabMenu = document.getElementById("salesFabMenu");
    const fabIcon = fab?.querySelector("i");
    const invoiceRowsBody = shell.querySelector(".js-sales-invoice-rows");
    const salesInvoiceView = document.querySelector(".js-sales-invoice-view");
    const salesInvoiceCloseButtons = Array.from(document.querySelectorAll(".js-sales-invoice-close"));
    const salesInvoiceItems = document.querySelector(".js-sales-invoice-items");
    const salesInvoiceNumber = document.querySelector(".js-sales-invoice-number");
    const salesInvoiceDate = document.querySelector(".js-sales-invoice-date");
    const salesInvoiceCustomer = document.querySelector(".js-sales-invoice-customer");
    const salesInvoiceStatus = document.querySelector(".js-sales-invoice-status");
    const salesInvoiceMeta = document.querySelector(".js-sales-invoice-meta");
    const salesInvoiceSubtotal = document.querySelector(".js-sales-invoice-subtotal");
    const salesInvoiceTotal = document.querySelector(".js-sales-invoice-total");
    const salesInvoiceGrandTotal = document.querySelector(".js-sales-invoice-grand-total");
    const salesInvoicePaidTotal = document.querySelector(".js-sales-invoice-paid-total");
    const salesInvoicePaymentLine = document.querySelector(".js-sales-invoice-payment-line");
    const salesInvoiceRemaining = document.querySelector(".js-sales-invoice-remaining");
    const salesInvoiceDownload = document.querySelector(".js-sales-invoice-download");
    const salesInvoicePrint = document.querySelector(".js-sales-invoice-print");
    const salesInvoiceCopy = document.querySelector(".js-sales-invoice-copy");
    const salesInvoiceEmail = document.querySelector(".js-sales-invoice-email");
    const salesInvoiceWhatsapp = document.querySelector(".js-sales-invoice-whatsapp");
    const salesEscapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;",
    }[char]));
    const fabConfig = {
        daily: { visible: false, icon: "plus-lg", menu: false },
        services: { visible: true, icon: "plus-lg", menu: true },
        classes: { visible: true, icon: "pencil", menu: true },
        invoices: { visible: true, icon: "plus-lg", menu: true },
        vouchers: { visible: false, icon: "plus-lg", menu: false },
        "cash-drawer": { visible: true, icon: "plus-lg", menu: true },
        "cash-flow": { visible: true, icon: "plus-lg", menu: true },
    };

    const applyTab = (tabName) => {
        tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.salesTab === tabName));
        panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.salesPanel === tabName));

        if (!fab || !fabIcon) {
            return;
        }

        const config = fabConfig[tabName] || fabConfig.daily;
        fab.style.display = config.visible ? "inline-flex" : "none";
        fabIcon.className = `bi bi-${config.icon}`;
        fab.dataset.salesFabTab = tabName;

        if (!config.menu) {
            fabMenu?.classList.remove("is-open");
        }
    };

    const salesFormatMoneyDecimal = (value) => `Rp ${Number(value || 0).toLocaleString("id-ID")},00`;

    const parseSalesInvoiceItems = (value) => {
        try {
            const parsed = JSON.parse(value || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    };

    const readSalesInvoiceFromRow = (row) => {
        const items = parseSalesInvoiceItems(row.dataset.items);
        const gross = Number(row.dataset.gross || 0);

        return {
            invoice: row.dataset.invoice || row.children[0]?.textContent?.trim() || "Faktur",
            customer: row.dataset.customer || row.children[1]?.textContent?.trim() || "Walk-In",
            date: row.dataset.date || row.children[2]?.textContent?.trim() || "",
            time: row.dataset.time || "",
            location: row.dataset.location || row.children[3]?.textContent?.trim() || "Star Salon",
            gross,
            status: (row.dataset.status || row.querySelector(".sales-status-pill")?.textContent || "PAID").trim().toUpperCase(),
            paymentMethod: row.dataset.paymentMethod || "CASH",
            items: items.length ? items : [{
                name: "Penjualan",
                qty: 1,
                price: gross,
                staff: "Rayhan Doni Pramana",
                time: row.dataset.time || "",
            }],
        };
    };

    const renderSalesInvoice = (invoice) => {
        const status = (invoice.status || "PAID").toUpperCase();
        const isPaid = status === "PAID";
        const items = Array.isArray(invoice.items) && invoice.items.length ? invoice.items : [];
        const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0) || Number(invoice.gross || 0);
        const remaining = isPaid ? 0 : subtotal;
        const invoiceLabel = String(invoice.invoice || "Faktur").replace(/^INV-/, "Faktur ");
        const createdLine = invoice.date ? `Dibuat pada ${salesEscapeHtml(invoice.date)}${invoice.time ? ` ${salesEscapeHtml(invoice.time)}` : ""}` : "Dibuat pada hari ini";
        const paidLine = isPaid ? `Dilunasi pada ${salesEscapeHtml(invoice.date)}${invoice.time ? ` ${salesEscapeHtml(invoice.time)}` : ""}` : `Tanggal jatuh tempo faktur ${salesEscapeHtml(invoice.date || "")}`;

        if (salesInvoiceItems) {
            salesInvoiceItems.innerHTML = items.map((item) => {
                const qty = Number(item.qty || 1);
                const price = Number(item.price || 0) * qty;
                return `
                    <div class="sales-invoice-paper__item">
                        <span>${salesEscapeHtml(String(qty))}</span>
                        <span>
                            <strong>${salesEscapeHtml(item.name || "Item")}</strong>
                            <small>${salesEscapeHtml(item.time || invoice.time || "")}<br>with ${salesEscapeHtml(item.staff || "Rayhan Doni Pramana")}</small>
                        </span>
                        <span>Rp</span>
                        <span>${Number(price || 0).toLocaleString("id-ID")},00</span>
                    </div>
                `;
            }).join("");
        }

        if (salesInvoiceNumber) {
            salesInvoiceNumber.textContent = invoiceLabel;
        }
        if (salesInvoiceDate) {
            salesInvoiceDate.textContent = invoice.date || "";
        }
        if (salesInvoiceCustomer) {
            salesInvoiceCustomer.textContent = invoice.customer || "Walk-In";
        }
        if (salesInvoiceStatus) {
            salesInvoiceStatus.textContent = status;
            salesInvoiceStatus.classList.toggle("is-unpaid", !isPaid);
        }
        if (salesInvoiceMeta) {
            salesInvoiceMeta.innerHTML = `
                <div>${createdLine}</div>
                <div>${paidLine}</div>
                <div>di ${salesEscapeHtml(invoice.location || "Star Salon")} Oleh Rayhan Doni Pramana dari POINT OF SALE</div>
            `;
        }
        if (salesInvoiceSubtotal) salesInvoiceSubtotal.textContent = salesFormatMoneyDecimal(subtotal).replace("Rp ", "");
        if (salesInvoiceTotal) salesInvoiceTotal.textContent = salesFormatMoneyDecimal(subtotal).replace("Rp ", "");
        if (salesInvoiceGrandTotal) salesInvoiceGrandTotal.textContent = salesFormatMoneyDecimal(subtotal).replace("Rp ", "");
        if (salesInvoicePaidTotal) salesInvoicePaidTotal.textContent = salesFormatMoneyDecimal(isPaid ? subtotal : 0).replace("Rp ", "");
        if (salesInvoiceRemaining) salesInvoiceRemaining.textContent = salesFormatMoneyDecimal(remaining).replace("Rp ", "");
        if (salesInvoicePaymentLine) {
            salesInvoicePaymentLine.hidden = !isPaid;
            salesInvoicePaymentLine.querySelector("span").textContent = invoice.paymentMethod || "CASH";
        }

        salesInvoiceView?.removeAttribute("hidden");
        document.body.classList.add("sales-invoice-open");
    };

    const closeSalesInvoice = () => {
        salesInvoiceView?.setAttribute("hidden", "");
        document.body.classList.remove("sales-invoice-open");
    };

    const currentInvoicePlainText = () => {
        const title = salesInvoiceNumber?.textContent || "Faktur";
        const total = salesInvoiceGrandTotal?.textContent || "0,00";
        return `${title}\nStar Salon\nTotal Rp ${total}`;
    };

    const injectPaidInvoiceRow = () => {
        if (!invoiceRowsBody) {
            return;
        }

        let invoice = null;
        try {
            invoice = JSON.parse(window.localStorage.getItem("starSalonLastPaidInvoice") || "null");
        } catch (error) {
            invoice = null;
        }

        if (!invoice || invoiceRowsBody.querySelector(".js-sales-paid-invoice-row")) {
            return;
        }

        invoiceRowsBody.querySelector(".sales-no-data")?.closest("tr")?.remove();
        const gross = Number(invoice.gross || 0);
        const row = document.createElement("tr");
        row.className = "js-sales-paid-invoice-row js-sales-invoice-row";
        row.dataset.invoice = invoice.invoice || "11";
        row.dataset.customer = invoice.customer || "Walk-In";
        row.dataset.date = invoice.date || "";
        row.dataset.time = invoice.time || "";
        row.dataset.location = invoice.location || "Star Salon";
        row.dataset.gross = String(gross);
        row.dataset.status = invoice.status || "PAID";
        row.dataset.paymentMethod = invoice.paymentMethod || "CASH";
        row.dataset.items = JSON.stringify(invoice.items || []);
        row.innerHTML = `
            <td>${salesEscapeHtml(invoice.invoice || "11")}</td>
            <td>${salesEscapeHtml(invoice.customer || "Walk-In")}</td>
            <td>${salesEscapeHtml(invoice.date || "")}</td>
            <td>${salesEscapeHtml(invoice.location || "Star Salon")}</td>
            <td>${salesEscapeHtml(invoice.tips || "0,00")}</td>
            <td>${formatCurrency(gross)}</td>
            <td><button class="sales-status-pill js-sales-invoice-open" type="button">${salesEscapeHtml(invoice.status || "PAID")}</button></td>
        `;
        invoiceRowsBody.prepend(row);
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => applyTab(tab.dataset.salesTab));
    });

    fab?.addEventListener("click", () => {
        fabMenu?.classList.toggle("is-open");
    });

    document.addEventListener("click", (event) => {
        if (!fab || !fabMenu) {
            return;
        }

        const target = event.target;
        if (fab.contains(target) || fabMenu.contains(target)) {
            return;
        }

        fabMenu.classList.remove("is-open");
    });

    invoiceRowsBody?.addEventListener("click", (event) => {
        const button = event.target.closest(".js-sales-invoice-open");
        if (!button) {
            return;
        }

        event.preventDefault();

        const row = button.closest(".js-sales-invoice-row");
        if (!row) {
            return;
        }

        renderSalesInvoice(readSalesInvoiceFromRow(row));
    });

    salesInvoiceCloseButtons.forEach((button) => {
        button.addEventListener("click", closeSalesInvoice);
    });

    salesInvoiceDownload?.addEventListener("click", () => {
        const blob = new Blob([currentInvoicePlainText()], { type: "text/plain;charset=utf-8" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = "faktur-star-salon.txt";
        link.click();
        URL.revokeObjectURL(url);
    });

    salesInvoicePrint?.addEventListener("click", () => window.print());

    salesInvoiceCopy?.addEventListener("click", () => {
        navigator.clipboard?.writeText(window.location.href);
    });

    salesInvoiceEmail?.addEventListener("click", () => {
        window.location.href = `mailto:?subject=${encodeURIComponent("Faktur Star Salon")}&body=${encodeURIComponent(currentInvoicePlainText())}`;
    });

    salesInvoiceWhatsapp?.addEventListener("click", () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(currentInvoicePlainText())}`, "_blank", "noopener");
    });

    injectPaidInvoiceRow();
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    const initialTab = tabs.some((tab) => tab.dataset.salesTab === requestedTab) ? requestedTab : "daily";
    applyTab(initialTab);
}

function initCustomerTabs() {
    const shell = document.querySelector(".js-customers-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".customers-tab"));
    const panels = Array.from(shell.querySelectorAll(".customers-panel"));
    const fab = shell.querySelector(".js-customers-fab");
    const fabIcon = fab?.querySelector("i");
    const fabConfig = {
        customers: {
            target: "#customerModal",
            label: "Tambah pelanggan",
            icon: "plus-lg",
        },
        tags: {
            target: "#customerTagModal",
            label: "Tambah tag pelanggan",
            icon: "plus-lg",
        },
    };

    const applyTab = (tabName) => {
        tabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.customerTab === tabName);
        });

        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.customerPanel === tabName);
        });

        if (!fab) {
            return;
        }

        const config = fabConfig[tabName] || fabConfig.customers;
        fab.setAttribute("data-bs-target", config.target);
        fab.setAttribute("aria-label", config.label);

        if (fabIcon) {
            fabIcon.className = `bi bi-${config.icon}`;
        }
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => applyTab(tab.dataset.customerTab));
    });

    applyTab("customers");

    initCustomerToolbar(shell);

    const params = new URLSearchParams(window.location.search);
    if (params.get("modal") === "customer" && typeof bootstrap !== "undefined") {
        const customerModal = document.getElementById("customerModal");
        if (customerModal) {
            bootstrap.Modal.getOrCreateInstance(customerModal).show();
        }
    }
}

function initCustomerToolbar(shell) {
    const table = shell.querySelector(".js-customers-table");
    if (!table) {
        return;
    }

    const tbody = table.querySelector("tbody");
    const searchInput = shell.querySelector(".js-customer-search");
    const tagToggleLabel = shell.querySelector(".js-customer-tag-label");
    const sortToggleLabel = shell.querySelector(".js-customer-sort-label");

    const normalize = (value) => (value || "").toString().toLowerCase();
    const parseDate = (value) => {
        const v = (value || "").toString().trim();
        if (!v) return null;
        const parsed = new Date(v);
        // Fallback for YYYY-MM-DD without timezone shifts.
        if (!Number.isNaN(parsed.getTime())) return parsed;
        const parts = v.split("-");
        if (parts.length === 3) {
            const year = Number(parts[0]);
            const month = Number(parts[1]) - 1;
            const day = Number(parts[2]);
            const d = new Date(year, month, day);
            if (!Number.isNaN(d.getTime())) return d;
        }
        return null;
    };
    const formatYmd = (d) => {
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const rows = Array.from(tbody.querySelectorAll("tr")).map((tr) => {
        const dataCell = tr.querySelector(".js-customer-row");
        const dataset = dataCell?.dataset || {};
        return {
            tr,
            id: dataset.customerId || "",
            name: dataset.customerName || tr.querySelector("strong")?.textContent || "",
            phone: dataset.customerPhone || "",
            email: dataset.customerEmail || "",
            memberId: dataset.customerMemberId || "",
            loyalty: Number(dataset.customerLoyalty || "0") || 0,
            lastVisit: dataset.customerLastVisit || "",
            birthdate: dataset.customerBirthdate || "",
            tags: (dataset.customerTags || "").split("|").filter(Boolean),
            gender: dataset.customerGender || "",
            status: dataset.customerStatus || "Aktif",
            notes: dataset.customerNotes || "",
            address: dataset.customerAddress || "",
        };
    });

    const state = {
        tag: "",
        query: "",
        sort: "name",
        sortLabel: "Nama",
        birthStart: "",
        birthEnd: "",
    };

    const matches = (row) => {
        if (state.tag) {
            if (!row.tags.some((t) => t === state.tag)) {
                return false;
            }
        }

        if (state.birthStart || state.birthEnd) {
            const bd = parseDate(row.birthdate);
            const start = parseDate(state.birthStart);
            const end = parseDate(state.birthEnd || state.birthStart);
            if (!bd || !start || !end) {
                return false;
            }
            const min = new Date(Math.min(start.getTime(), end.getTime()));
            const max = new Date(Math.max(start.getTime(), end.getTime()));
            if (bd.getTime() < min.getTime() || bd.getTime() > max.getTime()) {
                return false;
            }
        }

        if (!state.query) {
            return true;
        }

        const haystack = normalize([
            row.name,
            row.phone,
            row.email,
            row.memberId,
            row.birthdate,
            row.tags.join(" "),
        ].join(" "));
        return haystack.includes(normalize(state.query));
    };

    const sortRows = (items) => {
        const key = state.sort;
        const copy = items.slice();
        copy.sort((a, b) => {
            const ax = key === "last_visit" ? a.lastVisit : (key === "member_id" ? a.memberId : a[key] ?? "");
            const bx = key === "last_visit" ? b.lastVisit : (key === "member_id" ? b.memberId : b[key] ?? "");
            return normalize(ax).localeCompare(normalize(bx), "id");
        });
        return copy;
    };

    const apply = () => {
        const active = [];
        const inactive = [];
        rows.forEach((row) => {
            (matches(row) ? active : inactive).push(row);
        });

        const ordered = sortRows(active).concat(inactive);
        ordered.forEach((row) => {
            row.tr.style.display = matches(row) ? "" : "none";
        });

        // Reorder DOM to keep sorting consistent without losing hidden rows.
        ordered.forEach((row) => tbody.appendChild(row.tr));
    };

    searchInput?.addEventListener("input", () => {
        state.query = searchInput.value || "";
        apply();
    });

    shell.querySelectorAll(".js-customer-tag").forEach((button) => {
        button.addEventListener("click", () => {
            shell.querySelectorAll(".js-customer-tag").forEach((item) => item.classList.remove("is-active"));
            button.classList.add("is-active");
            state.tag = button.dataset.tag || "";
            if (tagToggleLabel) {
                tagToggleLabel.textContent = state.tag || "All Tags";
            }
            apply();
        });
    });

    shell.querySelectorAll(".js-customer-sort").forEach((button) => {
        button.addEventListener("click", () => {
            shell.querySelectorAll(".js-customer-sort").forEach((item) => item.classList.remove("is-active"));
            button.classList.add("is-active");
            state.sort = button.dataset.sort || "name";
            state.sortLabel = button.textContent?.trim() || "Nama";
            if (sortToggleLabel) {
                sortToggleLabel.textContent = state.sortLabel;
            }
            apply();
        });
    });

    // Export dropdown
    document.querySelectorAll(".js-customer-export").forEach((button) => {
        button.addEventListener("click", () => {
            const fmt = (button.dataset.export || "csv").toLowerCase();
            if (fmt !== "csv") {
                alert("Format ini akan menyusul. Saat ini export CSV tersedia.");
            }
            exportCsv();
        });
    });

    const exportCsv = () => {
        const visible = rows.filter((row) => matches(row));
        const header = ["Nama", "No. Telpon", "Email", "Member ID", "Loyalty Point", "Kunjungan Terakhir", "Tanggal Lahir", "Tags"];
        const csvLines = [header.join(",")];

        visible.forEach((row) => {
            const cells = Array.from(row.tr.querySelectorAll("td")).map((td) => (td.textContent || "").trim());
            // Drop last "Status" col.
            const payload = cells.slice(0, 8);
            csvLines.push(payload.map((value) => `"${value.replaceAll('"', '""')}"`).join(","));
        });

        const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 250);
    };

    // Birthdate date filter modal
    const birthModal = document.getElementById("customerBirthFilterModal");
    if (birthModal) {
        const startInput = birthModal.querySelector(".js-customer-birth-start");
        const endInput = birthModal.querySelector(".js-customer-birth-end");
        const rangeInput = birthModal.querySelector(".js-customer-birth-range");
        const resetBtn = birthModal.querySelector(".js-customer-birth-reset");
        const applyBtn = birthModal.querySelector(".js-customer-birth-apply");

        let fp = null;
        if (rangeInput && typeof flatpickr !== "undefined") {
            fp = flatpickr(rangeInput, {
                mode: "range",
                inline: true,
                dateFormat: "Y-m-d",
                onChange: (selectedDates) => {
                    const [a, b] = selectedDates;
                    if (startInput) startInput.value = a ? formatYmd(a) : "";
                    if (endInput) endInput.value = b ? formatYmd(b) : "";
                },
            });
        }

        const setRange = (start, end) => {
            if (startInput) startInput.value = start || "";
            if (endInput) endInput.value = end || "";
            if (fp) {
                const dates = [];
                if (start) dates.push(start);
                if (end) dates.push(end);
                fp.setDate(dates, true, "Y-m-d");
            }
        };

        birthModal.querySelectorAll(".js-customer-date-preset").forEach((btn) => {
            btn.addEventListener("click", () => {
                const preset = btn.dataset.preset;
                const today = new Date();
                const start = new Date(today);
                const end = new Date(today);

                if (preset === "today") {
                    // today
                } else if (preset === "yesterday") {
                    start.setDate(today.getDate() - 1);
                    end.setDate(today.getDate() - 1);
                } else if (preset === "7d") {
                    start.setDate(today.getDate() - 7);
                } else if (preset === "30d") {
                    start.setDate(today.getDate() - 30);
                } else if (preset === "this_month") {
                    start.setDate(1);
                } else if (preset === "last_month") {
                    start.setMonth(today.getMonth() - 1, 1);
                    end.setMonth(today.getMonth(), 0);
                } else if (preset === "this_year") {
                    start.setMonth(0, 1);
                } else if (preset === "last_year") {
                    start.setFullYear(today.getFullYear() - 1, 0, 1);
                    end.setFullYear(today.getFullYear() - 1, 11, 31);
                }

                setRange(formatYmd(start), formatYmd(end));
            });
        });

        startInput?.addEventListener("change", () => setRange(startInput.value, endInput?.value || ""));
        endInput?.addEventListener("change", () => setRange(startInput?.value || "", endInput.value));

        resetBtn?.addEventListener("click", () => {
            state.birthStart = "";
            state.birthEnd = "";
            setRange("", "");
            apply();
        });

        applyBtn?.addEventListener("click", () => {
            state.birthStart = (startInput?.value || "").trim();
            state.birthEnd = (endInput?.value || "").trim();
            apply();
        });
    }

    // Import modal (CSV)
    const importModal = document.getElementById("customerImportModal");
    if (importModal) {
        const fileInput = importModal.querySelector(".js-customer-import-file");
        const meta = importModal.querySelector(".js-customer-import-meta");
        const runBtn = importModal.querySelector(".js-customer-import-run");
        const tplBtn = importModal.querySelector(".js-customer-template");
        let pending = [];

        const parseCsv = (text) => {
            const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            if (!lines.length) return [];
            const header = lines[0].split(",").map((h) => normalize(h));
            const idx = (name) => header.indexOf(normalize(name));
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const raw = lines[i];
                const parts = raw.split(",").map((c) => c.replace(/^\"|\"$/g, "").trim());
                const get = (key, fallback = "") => {
                    const j = idx(key);
                    return j >= 0 ? (parts[j] || fallback) : fallback;
                };
                data.push({
                    name: get("nama") || get("name"),
                    phone: get("no. telpon") || get("phone"),
                    email: get("email"),
                    memberId: get("member id") || get("member_id"),
                    loyalty: Number(get("loyalty point", "0")) || 0,
                    lastVisit: get("kunjungan terakhir") || new Date().toISOString().slice(0, 10) + " 00:00:00",
                    birthdate: get("tanggal lahir") || "0000-00-00",
                    tags: (get("tags") || "").split("|").filter(Boolean),
                });
            }
            return data.filter((row) => row.name);
        };

        const buildTemplate = () => {
            const header = ["Nama", "No. Telpon", "Email", "Member ID", "Loyalty Point", "Kunjungan Terakhir", "Tanggal Lahir", "Tags"];
            const example = ["John Doe", "0813-0000-0000", "john@example.com", "MEM-0100", "0", "2026-04-13 10:00:00", "1990-01-01", "VIP|Haircut"];
            const blob = new Blob([`${header.join(",")}\n${example.join(",")}\n`], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "customers-template.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 250);
        };

        tplBtn?.addEventListener("click", buildTemplate);

        fileInput?.addEventListener("change", async () => {
            const file = fileInput.files?.[0];
            pending = [];
            if (!file) {
                if (meta) meta.textContent = "Belum ada file dipilih";
                if (runBtn) runBtn.textContent = "Import (0)";
                if (runBtn) runBtn.disabled = true;
                return;
            }

            const text = await file.text();
            pending = parseCsv(text);
            if (meta) meta.textContent = `${file.name} (${pending.length} baris)`;
            if (runBtn) runBtn.textContent = `Import (${pending.length})`;
            if (runBtn) runBtn.disabled = pending.length === 0;
        });

        const addRow = (payload) => {
            const id = `imp-${Math.random().toString(16).slice(2)}`;
            const tagsText = (payload.tags || []).join(", ");
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <button class="customers-person-button js-customer-open" type="button" aria-label="Ubah data pelanggan ${payload.name}">
                        <div class="customers-person-cell">
                            <div class="customers-person-cell__avatar"><i class="bi bi-emoji-smile"></i></div>
                            <strong>${payload.name}</strong>
                        </div>
                    </button>
                </td>
                <td class="js-customer-row"
                    data-customer-id="${id}"
                    data-customer-name="${payload.name}"
                    data-customer-phone="${payload.phone}"
                    data-customer-email="${payload.email}"
                    data-customer-member-id="${payload.memberId}"
                    data-customer-loyalty="${payload.loyalty}"
                    data-customer-last-visit="${payload.lastVisit}"
                    data-customer-birthdate="${payload.birthdate}"
                    data-customer-tags="${(payload.tags || []).join("|")}"
                    data-customer-gender="${payload.gender || ""}"
                    data-customer-status="${payload.status || "Aktif"}"
                    data-customer-notes="${payload.notes || ""}"
                    data-customer-address="${payload.address || ""}"
                >${payload.phone}</td>
                <td>${payload.email}</td>
                <td>${payload.memberId}</td>
                <td>${payload.loyalty}</td>
                <td>${payload.lastVisit}</td>
                <td>${payload.birthdate}</td>
                <td>${tagsText}</td>
                <td><span class="customers-status-pill">0 Pembatalan</span></td>
            `;
            tbody.appendChild(tr);
            rows.push({
                tr,
                id,
                name: payload.name,
                phone: payload.phone,
                email: payload.email,
                memberId: payload.memberId,
                loyalty: Number(payload.loyalty || 0) || 0,
                lastVisit: payload.lastVisit,
                birthdate: payload.birthdate,
                tags: payload.tags || [],
                gender: payload.gender || "",
                status: payload.status || "Aktif",
                notes: payload.notes || "",
                address: payload.address || "",
            });
        };

        runBtn?.addEventListener("click", () => {
            if (!pending.length) return;
            pending.forEach(addRow);
            pending = [];
            if (meta) meta.textContent = "Import selesai.";
            runBtn.textContent = "Import (0)";
            runBtn.disabled = true;
            fileInput.value = "";
            apply();
            if (typeof bootstrap !== "undefined") {
                bootstrap.Modal.getOrCreateInstance(importModal).hide();
            }
        });
    }

    const customerEditModalEl = document.getElementById("customerEditModal");
    if (customerEditModalEl && typeof bootstrap !== "undefined") {
        const editModal = bootstrap.Modal.getOrCreateInstance(customerEditModalEl);
        const editTitle = customerEditModalEl.querySelector(".js-customer-edit-title");
        const mainTabs = Array.from(customerEditModalEl.querySelectorAll("[data-customer-edit-tab]"));
        const mainPanels = Array.from(customerEditModalEl.querySelectorAll("[data-customer-edit-panel]"));
        const footer = customerEditModalEl.querySelector(".js-customer-edit-footer");
        const profileName = customerEditModalEl.querySelector(".js-customer-profile-name");
        const profilePhone = customerEditModalEl.querySelector(".js-customer-profile-phone");
        const profileMember = customerEditModalEl.querySelector(".js-customer-profile-member");
        const profileShortcuts = Array.from(customerEditModalEl.querySelectorAll(".js-customer-profile-shortcut"));
        const detailTabs = Array.from(customerEditModalEl.querySelectorAll("[data-customer-detail-tab]"));
        const upcomingCard = customerEditModalEl.querySelector(".js-customer-upcoming-card");
        const pastCard = customerEditModalEl.querySelector(".js-customer-past-card");
        const upcomingTitle = customerEditModalEl.querySelector(".js-customer-upcoming-title");
        const pastTitle = customerEditModalEl.querySelector(".js-customer-past-title");
        const upcomingHead = customerEditModalEl.querySelector(".js-customer-upcoming-head tr");
        const pastHead = customerEditModalEl.querySelector(".js-customer-past-head tr");
        const upcomingBody = customerEditModalEl.querySelector(".js-customer-upcoming-body");
        const pastBody = customerEditModalEl.querySelector(".js-customer-past-body");
        const upcomingTotal = customerEditModalEl.querySelector(".js-customer-upcoming-total");
        const pastTotal = customerEditModalEl.querySelector(".js-customer-past-total");
        const pageCurrent = Array.from(customerEditModalEl.querySelectorAll(".js-customer-page-current"));
        const pageInput = Array.from(customerEditModalEl.querySelectorAll(".js-customer-page-input"));
        const pagePrev = Array.from(customerEditModalEl.querySelectorAll(".js-customer-page-prev"));
        const pageNext = Array.from(customerEditModalEl.querySelectorAll(".js-customer-page-next"));
        const addAgendaBtn = customerEditModalEl.querySelector(".js-customer-add-agenda");
        const moreActionButtons = Array.from(customerEditModalEl.querySelectorAll(".js-customer-more-action"));
        const nameInput = customerEditModalEl.querySelector(".js-customer-edit-name");
        const phoneInput = customerEditModalEl.querySelector(".js-customer-edit-phone");
        const emailInput = customerEditModalEl.querySelector(".js-customer-edit-email");
        const memberIdInput = customerEditModalEl.querySelector(".js-customer-edit-member-id");
        const memberCounter = customerEditModalEl.querySelector(".js-customer-member-counter");
        const familyCardInput = customerEditModalEl.querySelector(".js-customer-edit-family-card");
        const familyCounter = customerEditModalEl.querySelector(".js-customer-family-counter");
        const passportInput = customerEditModalEl.querySelector(".js-customer-edit-passport");
        const notesInput = customerEditModalEl.querySelector(".js-customer-edit-notes");
        const addressInput = customerEditModalEl.querySelector(".js-customer-edit-address");
        const birthYearInput = customerEditModalEl.querySelector(".js-customer-edit-birth-year");
        const birthMonthInput = customerEditModalEl.querySelector(".js-customer-edit-birth-month");
        const birthDayInput = customerEditModalEl.querySelector(".js-customer-edit-birth-day");
        const genderButtons = Array.from(customerEditModalEl.querySelectorAll(".js-customer-gender button"));
        const notifyButtons = Array.from(customerEditModalEl.querySelectorAll(".js-customer-notify button"));
        const marketingToggle = customerEditModalEl.querySelector(".js-customer-marketing-toggle");
        const tagPickerLabel = customerEditModalEl.querySelector(".js-customer-tag-picker-label");
        const tagOptions = Array.from(customerEditModalEl.querySelectorAll(".js-customer-edit-tag-option"));
        const saveBtn = customerEditModalEl.querySelector(".js-customer-edit-save");
        const deleteBtn = customerEditModalEl.querySelector(".js-customer-delete");
        const photoChangeBtn = customerEditModalEl.querySelector(".js-customer-photo-change");
        const statSales = customerEditModalEl.querySelector(".js-customer-stat-sales");
        const statVouchers = customerEditModalEl.querySelector(".js-customer-stat-vouchers");
        const statDue = customerEditModalEl.querySelector(".js-customer-stat-due");
        const statBooking = customerEditModalEl.querySelector(".js-customer-stat-booking");
        const statComplete = customerEditModalEl.querySelector(".js-customer-stat-complete");
        const statCancel = customerEditModalEl.querySelector(".js-customer-stat-cancel");
        const statNoShow = customerEditModalEl.querySelector(".js-customer-stat-noshow");
        const customerAgendaModalEl = document.getElementById("customerAgendaModal");
        const customerAgendaModal = customerAgendaModalEl ? bootstrap.Modal.getOrCreateInstance(customerAgendaModalEl) : null;
        const agendaSearch = customerAgendaModalEl?.querySelector(".js-customer-agenda-search");
        const agendaFilters = Array.from(customerAgendaModalEl?.querySelectorAll(".js-customer-agenda-filter") || []);
        const agendaServiceCards = Array.from(customerAgendaModalEl?.querySelectorAll(".customer-agenda-service-card") || []);
        const agendaSummary = customerAgendaModalEl?.querySelector(".js-customer-agenda-summary");
        const agendaAddBtn = customerAgendaModalEl?.querySelector(".js-customer-agenda-add");
        const agendaCheckoutBtn = customerAgendaModalEl?.querySelector(".js-customer-agenda-checkout");
        const agendaSubmitBtn = customerAgendaModalEl?.querySelector(".js-customer-agenda-submit");
        const agendaName = customerAgendaModalEl?.querySelector(".js-customer-agenda-name");
        const agendaTag = customerAgendaModalEl?.querySelector(".js-customer-agenda-tag");
        const agendaMoreButtons = Array.from(customerAgendaModalEl?.querySelectorAll(".js-customer-agenda-more") || []);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const staffNames = ["Rayhan Doni Pramana", "Maya Putri", "Kevin Sebastian", "Nadia Maharani"];
        const serviceSets = [
            ["Creambath (2h)", "Cat rambut full (3h)", "Potong rambut pria (1h)"],
            ["Hair spa", "Signature Haircut", "Glossy Balayage"],
            ["Keratin Repair", "Hair Color Touch Up", "Spa Treatment"],
            ["Potong rambut wanita", "Creambath", "Hair Mask"],
        ];
        const productSets = [
            ["Argan Shampoo", "Hair Serum", "Heat Protect Spray"],
            ["Matte Clay", "Pomade", "Scalp Tonic"],
            ["Color Safe Mask", "Hair Oil", "Repair Conditioner"],
            ["Nail Serum", "Body Mist", "Leave-In Cream"],
        ];
        const statusLabels = {
            completed: "COMPLETED",
            new: "NEW",
            cancelled: "CANCELLED",
        };

        const detailState = {
            activeRow: null,
            activeMainTab: "profile",
            activeProfileTab: "agenda",
            pages: {
                upcoming: 1,
                past: 1,
            },
            form: {
                gender: "wanita",
                notify: "email",
                marketing: false,
                tags: [],
                photoSelected: false,
            },
            detailData: null,
        };
        const agendaState = {
            activeCategory: "all",
            selectedIds: new Set(),
            reopenCustomer: false,
        };
        const detailTableConfig = {
            agenda: {
                upcomingTitle: "Akan Datang",
                pastTitle: "Berlalu",
                upcomingColumns: ["Tanggal", "Tipe", "Nama", "Staff", "Lokasi", "Total", "Catatan", "Status"],
                pastColumns: ["Tanggal", "Tipe", "Nama", "Staff", "Lokasi", "Total", "Catatan", "Status"],
                renderRow: (item) => `
                    <tr>
                        <td>${escapeHtml(item.date)}</td>
                        <td>${escapeHtml(item.type)}</td>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.staff)}</td>
                        <td>${escapeHtml(item.location)}</td>
                        <td>${escapeHtml(item.total)}</td>
                        <td>${escapeHtml(item.note)}</td>
                        <td><span class="customer-detail-status customer-detail-status--${escapeHtml(item.statusKey)}">${escapeHtml(item.status)}</span></td>
                    </tr>
                `,
            },
            layanan: {
                pastColumns: ["Nama", "Tanggal Pembayaran", "Lokasi", "Kuantitas", "Total (Rp)"],
                renderRow: (item) => `
                    <tr>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${escapeHtml(item.paymentDate)}</td>
                        <td>${escapeHtml(item.location)}</td>
                        <td>${escapeHtml(item.quantity)}</td>
                        <td>${escapeHtml(item.total)}</td>
                    </tr>
                `,
            },
            produk: {
                pastColumns: ["Produk", "Jumlah", "Tanggal Pembayaran", "Lokasi", "Total"],
                renderRow: (item) => `
                    <tr>
                        <td>${escapeHtml(item.product)}</td>
                        <td>${escapeHtml(item.amount)}</td>
                        <td>${escapeHtml(item.paymentDate)}</td>
                        <td>${escapeHtml(item.location)}</td>
                        <td>${escapeHtml(item.total)}</td>
                    </tr>
                `,
            },
            faktur: {
                pastColumns: ["Tanggal Faktur", "Faktur", "Status", "Lokasi", "Total"],
                renderRow: (item) => `
                    <tr>
                        <td>${escapeHtml(item.invoiceDate)}</td>
                        <td>${escapeHtml(item.invoice)}</td>
                        <td><span class="customer-detail-status customer-detail-status--${escapeHtml(item.statusKey)}">${escapeHtml(item.status)}</span></td>
                        <td>${escapeHtml(item.location)}</td>
                        <td>${escapeHtml(item.total)}</td>
                    </tr>
                `,
            },
        };

        const escapeHtml = (value) => (value || "").toString()
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
        const normalizeGender = (value) => {
            const raw = normalize(value);
            if (raw.includes("laki") || raw === "pria") return "pria";
            if (raw.includes("perempuan") || raw === "wanita") return "wanita";
            return "non-active";
        };
        const formatMoney = (value) => new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(Number(value || 0));
        const formatBirthInputs = (value) => {
            const raw = (value || "").trim();
            const parts = raw.split("-");
            if (parts.length !== 3) {
                return { year: "", month: "", day: "" };
            }
            const monthIndex = Math.max(0, Number(parts[1]) - 1);
            return {
                year: parts[0] || "",
                month: monthNames[monthIndex] || "",
                day: parts[2] || "",
            };
        };
        const buildBirthdate = () => {
            const year = (birthYearInput?.value || "").trim();
            const month = (birthMonthInput?.value || "").trim();
            const day = (birthDayInput?.value || "").trim();
            const monthIndex = monthNames.findIndex((item) => normalize(item) === normalize(month));
            if (!year || monthIndex < 0 || !day) {
                return "";
            }
            return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
        };
        const updateCounter = (input, target) => {
            if (!input || !target) return;
            target.textContent = `${(input.value || "").trim().length} / 16`;
        };
        const applyMainTab = (tabName) => {
            detailState.activeMainTab = tabName;
            mainTabs.forEach((tab) => {
                tab.classList.toggle("is-active", tab.dataset.customerEditTab === tabName);
            });
            mainPanels.forEach((panel) => {
                panel.classList.toggle("is-active", panel.dataset.customerEditPanel === tabName);
            });
            if (footer) {
                footer.hidden = tabName !== "details";
            }
        };
        const applyProfileTab = (tabName) => {
            detailState.activeProfileTab = tabName;
            detailState.pages.upcoming = 1;
            detailState.pages.past = 1;
            detailTabs.forEach((tab) => {
                tab.classList.toggle("is-active", tab.dataset.customerDetailTab === tabName);
            });
            profileShortcuts.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.customerProfileTarget === tabName);
            });
            renderDetailTables();
        };
        const paged = (items, scope) => {
            const pageSize = 5;
            const safeItems = items || [];
            const pageCount = Math.max(1, Math.ceil(safeItems.length / pageSize));
            const current = Math.min(detailState.pages[scope], pageCount);
            detailState.pages[scope] = current;
            const start = (current - 1) * pageSize;
            return {
                total: safeItems.length,
                current,
                pageCount,
                items: safeItems.slice(start, start + pageSize),
            };
        };
        const renderTableHead = (target, columns) => {
            if (!target) return;
            target.innerHTML = (columns || []).map((column) => `<th>${escapeHtml(column)}</th>`).join("");
        };
        const renderRows = (target, items, renderRow, columnCount) => {
            if (!target) return;
            if (!items.length) {
                target.innerHTML = `<tr><td colspan="${columnCount || 1}" class="sales-no-data">No Data</td></tr>`;
                return;
            }
            target.innerHTML = items.map((item) => renderRow(item)).join("");
        };
        const renderDetailTables = () => {
            if (!detailState.detailData) return;
            const activeTab = detailState.activeProfileTab;
            const config = detailTableConfig[activeTab] || detailTableConfig.agenda;
            const bucket = detailState.detailData.sections[detailState.activeProfileTab] || { upcoming: [], past: [] };
            const upcoming = paged(bucket.upcoming, "upcoming");
            const past = paged(bucket.past, "past");
            const isAgenda = activeTab === "agenda";
            if (upcomingCard) upcomingCard.hidden = !isAgenda;
            if (upcomingTitle) {
                upcomingTitle.hidden = !isAgenda;
                upcomingTitle.textContent = config.upcomingTitle || "Akan Datang";
            }
            if (pastTitle) {
                pastTitle.hidden = !isAgenda;
                pastTitle.textContent = config.pastTitle || "Berlalu";
            }
            renderTableHead(upcomingHead, config.upcomingColumns || []);
            renderTableHead(pastHead, config.pastColumns || []);
            renderRows(upcomingBody, upcoming.items, config.renderRow, (config.upcomingColumns || []).length);
            renderRows(pastBody, past.items, config.renderRow, (config.pastColumns || []).length);
            if (upcomingTotal) upcomingTotal.textContent = `Total ${upcoming.total}`;
            if (pastTotal) pastTotal.textContent = `Total ${past.total}`;
            pageCurrent.forEach((node) => {
                const scope = node.dataset.customerPageScope || "upcoming";
                node.textContent = detailState.pages[scope];
            });
            pageInput.forEach((node) => {
                const scope = node.dataset.customerPageScope || "upcoming";
                node.textContent = detailState.pages[scope];
            });
            pagePrev.forEach((button) => {
                const scope = button.dataset.customerPageScope || "upcoming";
                button.disabled = detailState.pages[scope] <= 1;
            });
            pageNext.forEach((button) => {
                const scope = button.dataset.customerPageScope || "upcoming";
                const count = scope === "upcoming" ? upcoming.pageCount : past.pageCount;
                button.disabled = detailState.pages[scope] >= count;
            });
        };
        const buildDetailData = (row) => {
            const seed = Math.max(1, Number((row.id || "").replace(/\D/g, "")) || 1);
            const serviceNames = serviceSets[(seed - 1) % serviceSets.length];
            const productNames = productSets[(seed - 1) % productSets.length];
            const customerName = row.name;
            const location = "Star Salon";
            const totalSales = row.loyalty * 1250 + seed * 100000;
            const voucherUse = Math.max(0, row.tags.length - 1);
            const due = seed % 2 === 0 ? 50000 : 0;
            const totalBooking = 5 + seed;
            const completed = 2 + seed;
            const cancel = seed % 3;
            const noShow = seed % 2;
            const baseDay = 18;
            const buildDate = (dayOffset) => `${String(baseDay + dayOffset).padStart(2, "0")} Apr 2026`;
            const buildTotal = (value) => formatMoney(value);
            const agendaUpcoming = [
                {
                    date: "24 Apr 2026",
                    type: "Agenda",
                    name: serviceNames[0],
                    staff: staffNames[(seed - 1) % staffNames.length],
                    location,
                    total: buildTotal(160000 + seed * 10000),
                    note: "Konfirmasi ulang",
                    status: statusLabels.new,
                    statusKey: "new",
                },
                {
                    date: "26 Apr 2026",
                    type: "Agenda",
                    name: serviceNames[1],
                    staff: staffNames[seed % staffNames.length],
                    location,
                    total: buildTotal(220000 + seed * 12000),
                    note: "Request stylist",
                    status: statusLabels.new,
                    statusKey: "new",
                },
            ];
            const agendaPast = Array.from({ length: 5 }, (_, index) => ({
                date: buildDate(index),
                type: "Layanan",
                name: `${serviceNames.join(", ")}`,
                staff: staffNames[(seed + index) % staffNames.length],
                location,
                total: buildTotal(100000 + index * 35000),
                note: index === 4 ? "-" : "Datang tepat waktu",
                status: index === 4 ? statusLabels.completed : statusLabels.new,
                statusKey: index === 4 ? "completed" : "new",
            }));
            const servicePast = Array.from({ length: 5 }, (_, index) => ({
                name: serviceNames[index % serviceNames.length],
                paymentDate: buildDate(index),
                location,
                quantity: String((index % 3) + 1),
                total: buildTotal(100000 + index * 35000),
            }));
            const productPast = Array.from({ length: 5 }, (_, index) => ({
                product: productNames[index % productNames.length],
                amount: String((index % 2) + 1),
                paymentDate: buildDate(index),
                location,
                total: buildTotal(85000 + index * 15000),
            }));
            const invoicePast = Array.from({ length: 5 }, (_, index) => ({
                invoiceDate: buildDate(index),
                invoice: `INV-${seed}${index + 11}`,
                status: index === 0 ? statusLabels.new : statusLabels.completed,
                statusKey: index === 0 ? "new" : "completed",
                location,
                total: buildTotal(175000 + index * 25000),
            }));
            return {
                stats: {
                    totalSales: buildTotal(totalSales),
                    voucherUse,
                    due: buildTotal(due),
                    totalBooking,
                    completed,
                    cancel,
                    noShow,
                },
                sections: {
                    agenda: { upcoming: agendaUpcoming, past: agendaPast },
                    layanan: { upcoming: [], past: servicePast },
                    produk: { upcoming: [], past: productPast },
                    faktur: { upcoming: [], past: invoicePast },
                },
                serviceNames,
                customerName,
            };
        };
        const syncTagPicker = () => {
            if (!tagPickerLabel) return;
            tagPickerLabel.textContent = detailState.form.tags.length ? detailState.form.tags.join(", ") : "No item";
            tagOptions.forEach((button) => {
                const value = button.dataset.customerEditTag || "";
                button.classList.toggle("is-active", detailState.form.tags.includes(value));
            });
        };
        const syncFormButtons = () => {
            genderButtons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.customerGender === detailState.form.gender);
            });
            notifyButtons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.customerNotify === detailState.form.notify);
            });
            if (marketingToggle) {
                marketingToggle.checked = detailState.form.marketing;
            }
            updateCounter(memberIdInput, memberCounter);
            updateCounter(familyCardInput, familyCounter);
            syncTagPicker();
        };
        const fillForm = (row) => {
            const birthday = formatBirthInputs(row.birthdate);
            if (nameInput) nameInput.value = row.name;
            if (phoneInput) phoneInput.value = row.phone;
            if (emailInput) emailInput.value = row.email;
            if (memberIdInput) memberIdInput.value = row.memberId;
            if (familyCardInput) familyCardInput.value = (row.memberId || "").replace("MEM-", "");
            if (passportInput) passportInput.value = "";
            if (notesInput) notesInput.value = row.notes || "";
            if (addressInput) addressInput.value = row.address || "";
            if (birthYearInput) birthYearInput.value = birthday.year;
            if (birthMonthInput) birthMonthInput.value = birthday.month;
            if (birthDayInput) birthDayInput.value = birthday.day;
            detailState.form.gender = normalizeGender(row.gender);
            detailState.form.notify = row.email ? "email" : "off";
            detailState.form.marketing = row.tags.includes("VIP") || row.tags.includes("Loyal");
            detailState.form.tags = row.tags.slice();
            detailState.form.photoSelected = false;
            syncFormButtons();
        };
        const fillProfile = (row) => {
            detailState.detailData = buildDetailData(row);
            if (editTitle) editTitle.textContent = "Ubah Data Pelanggan";
            if (profileName) profileName.textContent = row.name;
            if (profilePhone) profilePhone.textContent = row.phone || "-";
            if (profileMember) profileMember.textContent = row.memberId || "-";
            if (statSales) statSales.textContent = detailState.detailData.stats.totalSales;
            if (statVouchers) statVouchers.textContent = detailState.detailData.stats.voucherUse;
            if (statDue) statDue.textContent = detailState.detailData.stats.due;
            if (statBooking) statBooking.textContent = detailState.detailData.stats.totalBooking;
            if (statComplete) statComplete.textContent = detailState.detailData.stats.completed;
            if (statCancel) statCancel.textContent = detailState.detailData.stats.cancel;
            if (statNoShow) statNoShow.textContent = detailState.detailData.stats.noShow;
            applyProfileTab("agenda");
        };
        const syncAgendaServices = () => {
            const query = normalize(agendaSearch?.value || "");
            agendaFilters.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.agendaFilter === agendaState.activeCategory);
            });
            agendaServiceCards.forEach((card) => {
                const matchesCategory = agendaState.activeCategory === "all" || card.dataset.agendaServiceCategory === agendaState.activeCategory;
                const matchesQuery = !query || normalize(card.dataset.agendaServiceName || "").includes(query);
                card.hidden = !(matchesCategory && matchesQuery);
                card.classList.toggle("is-selected", agendaState.selectedIds.has(card.dataset.agendaServiceId || ""));
            });
        };
        const syncAgendaSummary = () => {
            const selectedCards = agendaServiceCards.filter((card) => agendaState.selectedIds.has(card.dataset.agendaServiceId || ""));
            const total = selectedCards.reduce((sum, card) => sum + Number(card.dataset.agendaServicePrice || "0"), 0);
            const count = selectedCards.length;
            if (agendaSummary) agendaSummary.textContent = `${count} Layanan • Rp ${formatMoney(total)}`;
            if (agendaAddBtn) {
                agendaAddBtn.disabled = count === 0;
                agendaAddBtn.textContent = `Tambahkan ${count} Layanan`;
            }
            if (agendaCheckoutBtn) agendaCheckoutBtn.disabled = count === 0;
            if (agendaSubmitBtn) agendaSubmitBtn.disabled = count === 0;
        };
        const openAgendaModal = () => {
            if (!detailState.activeRow || !customerAgendaModal) return;
            agendaState.activeCategory = "all";
            agendaState.selectedIds = new Set();
            if (agendaSearch) agendaSearch.value = "";
            if (agendaName) agendaName.textContent = detailState.activeRow.name;
            if (agendaTag) agendaTag.textContent = detailState.activeRow.tags[0] || "Star Salon";
            syncAgendaServices();
            syncAgendaSummary();
            editModal.hide();
            window.setTimeout(() => {
                customerAgendaModal.show();
            }, 140);
        };
        const saveAgendaSelection = () => {
            if (!detailState.activeRow || !detailState.detailData || !agendaState.selectedIds.size) return;
            const selectedCards = agendaServiceCards.filter((card) => agendaState.selectedIds.has(card.dataset.agendaServiceId || ""));
            const total = selectedCards.reduce((sum, card) => sum + Number(card.dataset.agendaServicePrice || "0"), 0);
            detailState.detailData.sections.agenda.upcoming.unshift({
                date: "27 Apr 2026",
                type: "Agenda",
                name: selectedCards.map((card) => card.dataset.agendaServiceName || "").join(", "),
                staff: "Rayhan Doni Pramana",
                location: "Star Salon",
                total: formatMoney(total),
                note: "Dibuat dari Agenda Baru",
                status: statusLabels.new,
                statusKey: "new",
            });
            agendaState.reopenCustomer = true;
            customerAgendaModal.hide();
        };
        const openCustomerDetail = (row) => {
            detailState.activeRow = row;
            fillForm(row);
            fillProfile(row);
            applyMainTab("profile");
            editModal.show();
        };
        const updateRowDisplay = (row) => {
            const dataCell = row.tr.querySelector(".js-customer-row");
            const nameStrong = row.tr.querySelector(".customers-person-cell strong");
            const cells = row.tr.querySelectorAll("td");
            if (nameStrong) nameStrong.textContent = row.name;
            if (dataCell) {
                dataCell.dataset.customerName = row.name;
                dataCell.dataset.customerPhone = row.phone;
                dataCell.dataset.customerEmail = row.email;
                dataCell.dataset.customerMemberId = row.memberId;
                dataCell.dataset.customerLoyalty = String(row.loyalty);
                dataCell.dataset.customerBirthdate = row.birthdate;
                dataCell.dataset.customerTags = row.tags.join("|");
                dataCell.dataset.customerGender = row.gender;
                dataCell.dataset.customerStatus = row.status;
                dataCell.dataset.customerNotes = row.notes;
                dataCell.dataset.customerAddress = row.address;
                dataCell.textContent = row.phone;
            }
            if (cells[2]) cells[2].textContent = row.email;
            if (cells[3]) cells[3].textContent = row.memberId;
            if (cells[4]) cells[4].textContent = String(row.loyalty);
            if (cells[6]) cells[6].textContent = row.birthdate;
            if (cells[7]) cells[7].textContent = row.tags.join(", ");
        };
        const saveCustomerDetail = () => {
            if (!detailState.activeRow) return;
            const row = detailState.activeRow;
            row.name = (nameInput?.value || "").trim() || row.name;
            row.phone = (phoneInput?.value || "").trim();
            row.email = (emailInput?.value || "").trim();
            row.memberId = (memberIdInput?.value || "").trim();
            row.birthdate = buildBirthdate() || row.birthdate;
            row.tags = detailState.form.tags.slice();
            row.notes = (notesInput?.value || "").trim();
            row.address = (addressInput?.value || "").trim();
            row.gender = detailState.form.gender === "pria" ? "Laki-laki" : (detailState.form.gender === "wanita" ? "Perempuan" : "Non-Aktif");
            row.status = detailState.form.gender === "non-active" ? "Non-Aktif" : "Aktif";
            updateRowDisplay(row);
            fillProfile(row);
            apply();
            editModal.hide();
        };
        const deleteCustomer = () => {
            if (!detailState.activeRow) return;
            const index = rows.indexOf(detailState.activeRow);
            detailState.activeRow.tr.remove();
            if (index >= 0) rows.splice(index, 1);
            detailState.activeRow = null;
            apply();
            editModal.hide();
        };

        tbody.addEventListener("click", (event) => {
            const trigger = event.target instanceof HTMLElement ? event.target.closest(".js-customer-open") : null;
            if (!trigger) return;
            const tr = trigger.closest("tr");
            const row = rows.find((item) => item.tr === tr);
            if (row) {
                openCustomerDetail(row);
            }
        });

        mainTabs.forEach((tab) => {
            tab.addEventListener("click", () => applyMainTab(tab.dataset.customerEditTab || "profile"));
        });
        detailTabs.forEach((tab) => {
            tab.addEventListener("click", () => applyProfileTab(tab.dataset.customerDetailTab || "agenda"));
        });
        profileShortcuts.forEach((button) => {
            button.addEventListener("click", () => applyProfileTab(button.dataset.customerProfileTarget || "agenda"));
        });
        pagePrev.forEach((button) => {
            button.addEventListener("click", () => {
                const scope = button.dataset.customerPageScope || "upcoming";
                detailState.pages[scope] = Math.max(1, detailState.pages[scope] - 1);
                renderDetailTables();
            });
        });
        pageNext.forEach((button) => {
            button.addEventListener("click", () => {
                const scope = button.dataset.customerPageScope || "upcoming";
                detailState.pages[scope] += 1;
                renderDetailTables();
            });
        });
        addAgendaBtn?.addEventListener("click", () => {
            openAgendaModal();
        });
        moreActionButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.customerMoreAction || "";
                if (!detailState.activeRow) return;
                if (action === "block") {
                    if (!detailState.form.tags.includes("Blocked")) {
                        detailState.form.tags.push("Blocked");
                    }
                    syncTagPicker();
                    detailState.activeRow.status = "Blocked";
                    updateRowDisplay(detailState.activeRow);
                } else if (action === "delete") {
                    deleteCustomer();
                }
            });
        });
        agendaFilters.forEach((button) => {
            button.addEventListener("click", () => {
                agendaState.activeCategory = button.dataset.agendaFilter || "all";
                syncAgendaServices();
            });
        });
        agendaServiceCards.forEach((card) => {
            card.addEventListener("click", () => {
                const id = card.dataset.agendaServiceId || "";
                if (!id) return;
                if (agendaState.selectedIds.has(id)) {
                    agendaState.selectedIds.delete(id);
                } else {
                    agendaState.selectedIds.add(id);
                }
                syncAgendaServices();
                syncAgendaSummary();
            });
        });
        agendaSearch?.addEventListener("input", syncAgendaServices);
        agendaAddBtn?.addEventListener("click", saveAgendaSelection);
        agendaCheckoutBtn?.addEventListener("click", saveAgendaSelection);
        agendaSubmitBtn?.addEventListener("click", saveAgendaSelection);
        agendaMoreButtons.forEach((button) => {
            button.addEventListener("click", () => {
                if (!detailState.activeRow) return;
                if (!detailState.activeRow.tags.includes("Blocked")) {
                    detailState.activeRow.tags.push("Blocked");
                }
                detailState.activeRow.status = "Blocked";
                updateRowDisplay(detailState.activeRow);
            });
        });
        customerAgendaModalEl?.addEventListener("hidden.bs.modal", () => {
            if (!agendaState.reopenCustomer || !detailState.activeRow) return;
            agendaState.reopenCustomer = false;
            fillProfile(detailState.activeRow);
            applyMainTab("profile");
            applyProfileTab("agenda");
            editModal.show();
        });
        genderButtons.forEach((button) => {
            button.addEventListener("click", () => {
                detailState.form.gender = button.dataset.customerGender || "non-active";
                syncFormButtons();
            });
        });
        notifyButtons.forEach((button) => {
            button.addEventListener("click", () => {
                detailState.form.notify = button.dataset.customerNotify || "off";
                syncFormButtons();
            });
        });
        marketingToggle?.addEventListener("change", () => {
            detailState.form.marketing = Boolean(marketingToggle.checked);
        });
        tagOptions.forEach((button) => {
            button.addEventListener("click", () => {
                const tag = button.dataset.customerEditTag || "";
                if (!tag) return;
                if (detailState.form.tags.includes(tag)) {
                    detailState.form.tags = detailState.form.tags.filter((item) => item !== tag);
                } else {
                    detailState.form.tags.push(tag);
                }
                syncTagPicker();
            });
        });
        photoChangeBtn?.addEventListener("click", () => {
            detailState.form.photoSelected = !detailState.form.photoSelected;
            photoChangeBtn.querySelector("span").textContent = detailState.form.photoSelected ? "Foto Dipilih" : "Ganti";
        });
        memberIdInput?.addEventListener("input", () => updateCounter(memberIdInput, memberCounter));
        familyCardInput?.addEventListener("input", () => updateCounter(familyCardInput, familyCounter));
        saveBtn?.addEventListener("click", saveCustomerDetail);
        deleteBtn?.addEventListener("click", deleteCustomer);
    }

    // Edit tag modal (Tag Pelanggan -> klik ikon garis 3)
    const editTagModal = document.getElementById("customerEditTagModal");
    if (editTagModal && typeof bootstrap !== "undefined") {
        const nameInput = editTagModal.querySelector(".js-edit-tag-name");
        const listWrap = editTagModal.querySelector(".js-edit-tag-list");
        const saveBtn = editTagModal.querySelector(".js-edit-tag-save");
        const delBtn = editTagModal.querySelector(".js-edit-tag-delete");
        let activeTrigger = null;

        const renderList = (names) => {
            if (!listWrap) {
                return;
            }
            const cleaned = (names || []).map((n) => (n || "").trim()).filter(Boolean);
            if (!cleaned.length) {
                listWrap.innerHTML = `
                    <div class="customers-tag-edit-empty">
                        <div class="customers-tag-edit-empty__icon"><i class="bi bi-person-circle"></i></div>
                        <div class="customers-tag-edit-empty__title">Belum Ada Pelanggan Di Dalam Tag Ini</div>
                        <div class="customers-tag-edit-empty__sub">Tambahkan tag di halaman detail pelanggan</div>
                    </div>
                `;
                return;
            }

            listWrap.innerHTML = cleaned
                .map((n) => `<a class="customers-tag-edit-chip" href="#" onclick="return false;">${n}</a>`)
                .join("");
        };

        editTagModal.addEventListener("show.bs.modal", (event) => {
            activeTrigger = event.relatedTarget;
            const tagName = activeTrigger?.dataset?.tagName || "";
            const customers = (activeTrigger?.dataset?.tagCustomers || "")
                .split("|")
                .map((n) => n.trim())
                .filter(Boolean);

            if (nameInput) {
                nameInput.value = tagName;
            }
            renderList(customers);
        });

        saveBtn?.addEventListener("click", () => {
            const nextName = (nameInput?.value || "").trim();
            if (!activeTrigger || !nextName) {
                bootstrap.Modal.getOrCreateInstance(editTagModal).hide();
                return;
            }

            // Update row text (demo only, no persistence)
            const row = activeTrigger.closest(".customers-tag-row");
            row?.querySelector(".customers-tag-row__name")?.replaceChildren(document.createTextNode(nextName));
            activeTrigger.dataset.tagName = nextName;

            bootstrap.Modal.getOrCreateInstance(editTagModal).hide();
        });

        delBtn?.addEventListener("click", () => {
            if (!activeTrigger) {
                bootstrap.Modal.getOrCreateInstance(editTagModal).hide();
                return;
            }
            const row = activeTrigger.closest(".customers-tag-row");
            row?.remove();
            bootstrap.Modal.getOrCreateInstance(editTagModal).hide();
        });
    }

    apply();
}

function initStaffTabs() {
    const shell = document.querySelector(".js-staff-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".staff-tab"));
    const panels = Array.from(shell.querySelectorAll(".staff-panel"));
    const fabGroup = shell.querySelector("[data-staff-fab-group]");
    const modeButtons = Array.from(shell.querySelectorAll(".staff-mode-btn[data-staff-mode]"));
    const modePanels = Array.from(shell.querySelectorAll("[data-staff-mode-panel]"));
    const weekRange = shell.querySelector(".js-staff-week-range");
    const monthRange = shell.querySelector(".js-staff-month-range");
    const weekPicker = shell.querySelector(".js-staff-week-picker");

    const applyTab = (tabName) => {
        tabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.staffTab === tabName);
        });

        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.staffPanel === tabName);
        });

        if (fabGroup) {
            fabGroup.style.display = tabName === "members" ? "flex" : "none";
        }
    };

    const applyMode = (mode) => {
        modeButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.staffMode === mode);
        });

        modePanels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.staffModePanel === mode);
        });

        if (weekRange) {
            weekRange.hidden = mode !== "week";
        }

        if (monthRange) {
            monthRange.hidden = mode !== "month";
        }
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => applyTab(tab.dataset.staffTab));
    });

    modeButtons.forEach((button) => {
        button.addEventListener("click", () => applyMode(button.dataset.staffMode));
    });

    initStaffDatePickers({ shell, weekRange, monthRange, weekPicker });
    initStaffWorkModal(shell);
    initStaffToolbarActions(shell);
    initStaffNewModal(shell);

    applyTab("work");
    applyMode("week");
}

function initInventoryPage() {
    const shell = document.querySelector(".js-inventory-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll("[data-inventory-tab]"));
    const panels = Array.from(shell.querySelectorAll("[data-inventory-panel]"));
    const inventoryFab = shell.querySelector(".js-inventory-fab");
    const inventoryFabIcon = inventoryFab?.querySelector("i");
    const inventoryFabMenu = shell.querySelector(".js-inventory-fab-menu");
    const purchaseActionButtons = Array.from(shell.querySelectorAll(".js-inventory-purchase-action"));
    const purchaseFabCloseButton = shell.querySelector(".js-inventory-fab-close");
    const productPanel = shell.querySelector('[data-inventory-panel="products"]');
    const productSearch = productPanel?.querySelector(".js-inventory-search");
    const productRows = Array.from(productPanel?.querySelectorAll("[data-inventory-row]") || []);
    const productBody = productPanel?.querySelector("tbody");
    const productTotal = productPanel?.querySelector(".js-inventory-total");
    const purchasePanel = shell.querySelector('[data-inventory-panel="purchases"]');
    const purchaseSearch = purchasePanel?.querySelector(".js-inventory-purchase-search");
    const purchaseRows = Array.from(purchasePanel?.querySelectorAll("[data-inventory-purchase-row]") || []);
    const purchaseBody = purchasePanel?.querySelector("tbody");
    const purchaseTotal = purchasePanel?.querySelector(".js-inventory-purchase-total");
    const purchaseLocationToggle = purchasePanel?.querySelector(".js-inventory-purchase-location-toggle");
    const purchaseLocationOptions = Array.from(purchasePanel?.querySelectorAll(".js-inventory-purchase-location-option") || []);
    const opnamePanel = shell.querySelector('[data-inventory-panel="opname"]');
    const opnameSearch = opnamePanel?.querySelector(".js-inventory-opname-search");
    const opnameRows = Array.from(opnamePanel?.querySelectorAll("[data-inventory-opname-row]") || []);
    const opnameBody = opnamePanel?.querySelector(".js-inventory-opname-body");
    const opnameTotal = opnamePanel?.querySelector(".js-inventory-opname-total");
    const opnameStatusToggle = opnamePanel?.querySelector(".js-inventory-opname-status-toggle");
    const opnameStatusOptions = Array.from(opnamePanel?.querySelectorAll(".js-inventory-opname-status-option") || []);
    const opnameRangeLabel = opnamePanel?.querySelector(".js-inventory-opname-range-label");
    const opnameRangeValues = opnamePanel?.querySelector(".js-inventory-opname-range-values");
    const opnameDetailModalEl = document.getElementById("inventoryOpnameDetailModal");
    const opnameDetailModal = opnameDetailModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameDetailModalEl)
        : null;
    const opnameDetailSearch = opnameDetailModalEl?.querySelector(".js-inventory-opname-detail-search");
    const opnameDetailRows = Array.from(opnameDetailModalEl?.querySelectorAll(".js-inventory-opname-detail-row") || []);
    const opnameDetailTotal = opnameDetailModalEl?.querySelector(".js-inventory-opname-detail-total");
    const opnameSummaryName = opnameDetailModalEl?.querySelector(".js-inventory-opname-summary-name");
    const opnameSummaryNote = opnameDetailModalEl?.querySelector(".js-inventory-opname-summary-note");
    const opnameSummaryStart = opnameDetailModalEl?.querySelector(".js-inventory-opname-summary-start");
    const opnameSummaryLocation = opnameDetailModalEl?.querySelector(".js-inventory-opname-summary-location");
    const opnameSummaryStaff = opnameDetailModalEl?.querySelector(".js-inventory-opname-summary-staff");
    const opnameReviewButton = opnameDetailModalEl?.querySelector(".js-inventory-opname-review");
    const opnameEditModalEl = document.getElementById("inventoryOpnameEditModal");
    const opnameEditModal = opnameEditModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameEditModalEl)
        : null;
    const opnameImportModalEl = document.getElementById("inventoryOpnameImportModal");
    const opnameImportModal = opnameImportModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameImportModalEl)
        : null;
    const opnameEditOpen = opnameDetailModalEl?.querySelector(".js-inventory-opname-edit-open");
    const opnameImportOpen = opnameDetailModalEl?.querySelector(".js-inventory-opname-import-open");
    const opnameEditName = opnameEditModalEl?.querySelector(".js-inventory-opname-edit-name");
    const opnameEditNote = opnameEditModalEl?.querySelector(".js-inventory-opname-edit-note");
    const opnameEditCounter = opnameEditModalEl?.querySelector(".js-inventory-opname-edit-counter");
    const opnameEditSave = opnameEditModalEl?.querySelector(".js-inventory-opname-edit-save");
    const opnameImportTemplate = opnameImportModalEl?.querySelector(".js-inventory-opname-template");
    const opnameImportFile = opnameImportModalEl?.querySelector(".js-inventory-opname-import-file");
    const opnameImportFileLabel = opnameImportModalEl?.querySelector(".js-inventory-opname-import-file-label");
    const opnameImportMeta = opnameImportModalEl?.querySelector(".js-inventory-opname-import-meta");
    const opnameImportRun = opnameImportModalEl?.querySelector(".js-inventory-opname-import-run");
    const opnameDetailMenuButtons = Array.from(opnameDetailModalEl?.querySelectorAll(".js-inventory-opname-row-menu") || []);
    const opnameResetButtons = Array.from(opnameDetailModalEl?.querySelectorAll(".js-inventory-opname-reset") || []);
    const opnameReviewModalEl = document.getElementById("inventoryOpnameReviewModal");
    const opnameReviewModal = opnameReviewModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameReviewModalEl)
        : null;
    const opnameReviewTitle = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-title");
    const opnameReviewSummary = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-summary");
    const opnameReviewName = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-name");
    const opnameReviewNote = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-note");
    const opnameReviewStart = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-start");
    const opnameReviewEndWrap = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-ended-wrap");
    const opnameReviewEnd = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-end");
    const opnameReviewLocation = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-location");
    const opnameReviewStaff = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-staff");
    const opnameReviewReviewedWrap = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-reviewed-wrap");
    const opnameReviewReviewedBy = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-reviewed-by");
    const opnameReviewStatus = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-status");
    const opnameReviewCancelled = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-cancelled");
    const opnameReviewCancelledBy = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-cancelled-by");
    const opnameReviewBody = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-body");
    const opnameReviewTotal = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-total");
    const opnameReviewSearch = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-search");
    const opnameReviewFilters = Array.from(opnameReviewModalEl?.querySelectorAll(".js-inventory-opname-review-filter") || []);
    const opnameReviewMore = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-more");
    const opnameReviewMoreMenu = opnameReviewModalEl?.querySelector(".inventory-opname-review__more-menu");
    const opnameReviewRecount = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-recount");
    const opnameReviewCancelOpen = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-cancel-open");
    const opnameReviewComplete = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-complete");
    const opnameReviewExport = opnameReviewModalEl?.querySelector(".js-inventory-opname-review-export");
    const opnameCancelModalEl = document.getElementById("inventoryOpnameCancelModal");
    const opnameCancelModal = opnameCancelModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameCancelModalEl)
        : null;
    const opnameCancelNote = opnameCancelModalEl?.querySelector(".js-inventory-opname-cancel-note");
    const opnameCancelCounter = opnameCancelModalEl?.querySelector(".js-inventory-opname-cancel-counter");
    const opnameCancelSubmit = opnameCancelModalEl?.querySelector(".js-inventory-opname-cancel-submit");
    const opnameCompleteModalEl = document.getElementById("inventoryOpnameCompleteModal");
    const opnameCompleteModal = opnameCompleteModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameCompleteModalEl)
        : null;
    const opnameCompleteSubmit = opnameCompleteModalEl?.querySelector(".js-inventory-opname-complete-submit");
    const masterPanel = shell.querySelector('[data-inventory-panel="master"]');
    const masterTabs = Array.from(masterPanel?.querySelectorAll("[data-inventory-master-tab]") || []);
    const masterPanels = Array.from(masterPanel?.querySelectorAll("[data-inventory-master-panel]") || []);
    const brandPanel = masterPanel?.querySelector('[data-inventory-master-panel="brands"]');
    const brandSearch = brandPanel?.querySelector(".js-inventory-brand-search");
    const brandRows = Array.from(brandPanel?.querySelectorAll("[data-inventory-brand-row]") || []);
    const brandTotal = brandPanel?.querySelector(".js-inventory-brand-total");
    const categoryPanel = masterPanel?.querySelector('[data-inventory-master-panel="categories"]');
    const categorySearch = categoryPanel?.querySelector(".js-inventory-category-search");
    const categoryRows = Array.from(categoryPanel?.querySelectorAll("[data-inventory-category-row]") || []);
    const categoryTotal = categoryPanel?.querySelector(".js-inventory-category-total");
    const supplierPanel = masterPanel?.querySelector('[data-inventory-master-panel="suppliers"]');
    const supplierSearch = supplierPanel?.querySelector(".js-inventory-supplier-search");
    const supplierRows = Array.from(supplierPanel?.querySelectorAll("[data-inventory-supplier-row]") || []);
    const supplierBody = supplierPanel?.querySelector("tbody");
    const supplierTotal = supplierPanel?.querySelector(".js-inventory-supplier-total");
    const masterItemModalEl = document.getElementById("inventoryMasterItemModal");
    const masterItemModal = masterItemModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(masterItemModalEl)
        : null;
    const masterItemTitle = masterItemModalEl?.querySelector(".js-master-item-title");
    const masterItemName = masterItemModalEl?.querySelector(".js-master-item-name");
    const masterItemSave = masterItemModalEl?.querySelector(".js-master-item-save");
    const masterItemDelete = masterItemModalEl?.querySelector(".js-master-item-delete");
    const supplierModalEl = document.getElementById("inventorySupplierModal");
    const supplierModal = supplierModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(supplierModalEl)
        : null;
    const supplierModalTitle = supplierModalEl?.querySelector(".js-master-supplier-title");
    const supplierModalSave = supplierModalEl?.querySelector(".js-master-supplier-save");
    const supplierModalDelete = supplierModalEl?.querySelector(".js-master-supplier-delete");
    const supplierModalName = supplierModalEl?.querySelector(".js-master-supplier-name");
    const supplierModalDescription = supplierModalEl?.querySelector(".js-master-supplier-description");
    const supplierModalContact = supplierModalEl?.querySelector(".js-master-supplier-contact");
    const supplierModalEmail = supplierModalEl?.querySelector(".js-master-supplier-email");
    const supplierModalPhone = supplierModalEl?.querySelector(".js-master-supplier-phone");
    const supplierModalWebsite = supplierModalEl?.querySelector(".js-master-supplier-website");
    const supplierModalAddress = supplierModalEl?.querySelector(".js-master-supplier-address");
    const supplierModalCity = supplierModalEl?.querySelector(".js-master-supplier-city");
    const supplierModalCountry = supplierModalEl?.querySelector(".js-master-supplier-country");
    const supplierModalPostal = supplierModalEl?.querySelector(".js-master-supplier-postal");
    const productModalEl = document.getElementById("inventoryProductModal");
    const productModal = productModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(productModalEl)
        : null;
    const productModalTabsWrap = productModalEl?.querySelector(".js-inventory-product-tabs");
    const productModalTabs = Array.from(productModalEl?.querySelectorAll("[data-inventory-product-tab]") || []);
    const productModalPanels = Array.from(productModalEl?.querySelectorAll("[data-inventory-product-panel]") || []);
    const productModalTitle = productModalEl?.querySelector(".js-inventory-product-title");
    const productSectionTitle = productModalEl?.querySelector(".js-inventory-product-section-title");
    const productNameInput = productModalEl?.querySelector(".js-inventory-product-name");
    const productCategoryInput = productModalEl?.querySelector(".js-inventory-product-category");
    const productBrandInput = productModalEl?.querySelector(".js-inventory-product-brand");
    const productDescriptionInput = productModalEl?.querySelector(".js-inventory-product-description");
    const productSaveButton = productModalEl?.querySelector(".js-inventory-product-save");
    const productCancelButton = productModalEl?.querySelector(".js-inventory-product-cancel");
    const productSalesToggle = productModalEl?.querySelector(".js-inventory-sales-toggle");
    const productSalesNote = productModalEl?.querySelector(".js-inventory-sales-note");
    const productSalesNoteLabel = productSalesNote?.querySelector("span");
    const productPhotoCopy = productModalEl?.querySelector(".js-inventory-product-photo-copy");
    const productPhotoHelp = productModalEl?.querySelector(".js-inventory-product-photo-help");
    const productHistoryName = productModalEl?.querySelector(".js-inventory-product-history-name");
    const productHistoryTotalCost = productModalEl?.querySelector(".js-inventory-product-history-total-cost");
    const productHistoryAverageCost = productModalEl?.querySelector(".js-inventory-product-history-average-cost");
    const productHistoryLocation = productModalEl?.querySelector(".js-inventory-product-history-location");
    const productHistoryQty = productModalEl?.querySelector(".js-inventory-product-history-qty");
    const productHistoryRowQty = productModalEl?.querySelector(".js-inventory-product-history-row-qty");
    const productHistoryRowCost = productModalEl?.querySelector(".js-inventory-product-history-row-cost");
    const productHistoryRowReal = productModalEl?.querySelector(".js-inventory-product-history-row-real");
    const historyLocationToggle = productModalEl?.querySelector(".js-inventory-history-location-toggle");
    const historyLocationMenu = productModalEl?.querySelector(".inventory-product-history-card__location-menu");
    const historyLocationOptions = Array.from(productModalEl?.querySelectorAll(".js-inventory-history-location-option") || []);
    const historyStockIncrease = productModalEl?.querySelector(".js-inventory-history-stock-increase");
    const historyStockDecrease = productModalEl?.querySelector(".js-inventory-history-stock-decrease");
    const historyRangeButton = productModalEl?.querySelector(".js-inventory-history-range");
    const historyRangeLabel = productModalEl?.querySelector(".js-inventory-history-range-label");
    const historyRangeValue = productModalEl?.querySelector(".js-inventory-history-range-value");
    const historyExportButton = productModalEl?.querySelector(".js-inventory-history-export");
    const historyBody = productModalEl?.querySelector(".js-inventory-history-body");
    const historyTotal = productModalEl?.querySelector(".js-inventory-history-total");
    const historyPageSizeButton = productModalEl?.querySelector(".js-inventory-history-page-size");
    const historyPageSizeLabel = productModalEl?.querySelector(".js-inventory-history-page-size-label");
    const historyPrevButton = productModalEl?.querySelector(".js-inventory-history-prev");
    const historyCurrentPage = productModalEl?.querySelector(".js-inventory-history-current");
    const historyNextButton = productModalEl?.querySelector(".js-inventory-history-next");
    const historyGotoButton = productModalEl?.querySelector(".js-inventory-history-goto");
    const variantList = productModalEl?.querySelector(".js-inventory-variant-list");
    const variantAddButton = productModalEl?.querySelector(".js-inventory-variant-add");
    const variantTemplate = document.getElementById("inventoryVariantTemplate");
    const productLocationSearch = productModalEl?.querySelector(".js-inventory-location-search");
    const productLocationItems = Array.from(productModalEl?.querySelectorAll(".inventory-location-item") || []);
    const stockAdjustmentLayer = productModalEl?.querySelector(".inventory-stock-adjustment");
    const stockAdjustmentTitle = productModalEl?.querySelector(".js-inventory-stock-adjustment-title");
    const stockAdjustmentSummary = productModalEl?.querySelector(".js-inventory-stock-adjustment-summary");
    const stockAdjustmentLocation = productModalEl?.querySelector(".js-inventory-stock-adjustment-location");
    const stockAdjustmentCurrent = productModalEl?.querySelector(".js-inventory-stock-adjustment-current");
    const stockAdjustmentQtyLabel = productModalEl?.querySelector(".js-inventory-stock-adjustment-qty-label");
    const stockAdjustmentQty = productModalEl?.querySelector(".js-inventory-stock-adjustment-qty");
    const stockAdjustmentQtyDecrease = productModalEl?.querySelector(".js-inventory-stock-adjustment-decrease");
    const stockAdjustmentQtyIncrease = productModalEl?.querySelector(".js-inventory-stock-adjustment-increase");
    const stockAdjustmentPriceField = productModalEl?.querySelector(".js-inventory-stock-adjustment-price-field");
    const stockAdjustmentPrice = productModalEl?.querySelector(".js-inventory-stock-adjustment-price");
    const stockAdjustmentReasons = productModalEl?.querySelector(".js-inventory-stock-adjustment-reasons");
    const stockAdjustmentNoteField = productModalEl?.querySelector(".js-inventory-stock-adjustment-note-field");
    const stockAdjustmentNote = productModalEl?.querySelector(".js-inventory-stock-adjustment-note");
    const stockAdjustmentSave = productModalEl?.querySelector(".js-inventory-stock-adjustment-save");
    const stockAdjustmentCloseButtons = Array.from(productModalEl?.querySelectorAll(".js-inventory-stock-adjustment-close") || []);
    const quickModalEl = document.getElementById("inventoryQuickActionModal");
    const quickModal = quickModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(quickModalEl)
        : null;
    const quickTitle = quickModalEl?.querySelector("h2");
    const quickCopy = quickModalEl?.querySelector("p");
    const purchaseOrderModalEl = document.getElementById("inventoryPurchaseOrderModal");
    const purchaseOrderModal = purchaseOrderModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(purchaseOrderModalEl)
        : null;
    const orderProgressSteps = Array.from(purchaseOrderModalEl?.querySelectorAll("[data-order-progress]") || []);
    const orderPanels = Array.from(purchaseOrderModalEl?.querySelectorAll("[data-order-panel]") || []);
    const orderSupplierGrid = purchaseOrderModalEl?.querySelector('[data-order-panel="supplier"] .inventory-order-pick-grid');
    const orderSupplierOptions = Array.from(purchaseOrderModalEl?.querySelectorAll(".js-order-supplier-option") || []);
    const orderLocationOptions = Array.from(purchaseOrderModalEl?.querySelectorAll(".js-order-location-option") || []);
    const orderSelectedSupplier = purchaseOrderModalEl?.querySelector(".js-order-selected-supplier");
    const orderSelectedSupplierMeta = purchaseOrderModalEl?.querySelector(".js-order-selected-supplier-meta");
    const orderSelectedLocation = purchaseOrderModalEl?.querySelector(".js-order-selected-location");
    const orderSelectedLocationMeta = purchaseOrderModalEl?.querySelector(".js-order-selected-location-meta");
    const orderTotal = purchaseOrderModalEl?.querySelector(".js-order-total");
    const orderNoteToggle = purchaseOrderModalEl?.querySelector(".js-order-note-toggle");
    const orderNote = purchaseOrderModalEl?.querySelector(".js-order-note");
    const orderProductSearch = purchaseOrderModalEl?.querySelector(".js-order-product-search");
    const orderProductSuggestions = purchaseOrderModalEl?.querySelector(".js-order-product-suggestions");
    const orderItemsBody = purchaseOrderModalEl?.querySelector(".js-order-items");
    const orderSubmitButton = purchaseOrderModalEl?.querySelector(".js-order-submit");
    const orderBackButton = purchaseOrderModalEl?.querySelector(".js-order-back");
    const purchaseDetailModalEl = document.getElementById("inventoryPurchaseDetailModal");
    const purchaseDetailModal = purchaseDetailModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(purchaseDetailModalEl)
        : null;
    const orderDetailTitle = purchaseDetailModalEl?.querySelector(".js-order-detail-title");
    const orderDetailHead = purchaseDetailModalEl?.querySelector(".inventory-order-detail__head");
    const orderDetailStatus = purchaseDetailModalEl?.querySelector(".js-order-detail-status");
    const orderDetailDate = purchaseDetailModalEl?.querySelector(".js-order-detail-date");
    const orderDetailTools = purchaseDetailModalEl?.querySelector(".inventory-order-detail__tools");
    const orderDetailSupplier = purchaseDetailModalEl?.querySelector(".js-order-detail-supplier");
    const orderDetailSupplierMeta = purchaseDetailModalEl?.querySelector(".js-order-detail-supplier-meta");
    const orderDetailLocation = purchaseDetailModalEl?.querySelector(".js-order-detail-location");
    const orderDetailLocationMeta = purchaseDetailModalEl?.querySelector(".js-order-detail-location-meta");
    const orderDetailTotal = purchaseDetailModalEl?.querySelector(".js-order-detail-total");
    const orderDetailNote = purchaseDetailModalEl?.querySelector(".js-order-detail-note");
    const orderDetailNoteSection = purchaseDetailModalEl?.querySelector(".js-order-detail-note-section");
    const orderDetailItemsHead = purchaseDetailModalEl?.querySelector(".js-order-detail-items-head");
    const orderDetailItems = purchaseDetailModalEl?.querySelector(".js-order-detail-items");
    const orderDetailLogs = purchaseDetailModalEl?.querySelector(".js-order-detail-logs");
    const orderDetailEmail = purchaseDetailModalEl?.querySelector(".js-order-detail-email");
    const orderDetailPdf = purchaseDetailModalEl?.querySelector(".js-order-detail-pdf");
    const orderDetailCancel = purchaseDetailModalEl?.querySelector(".js-order-detail-cancel");
    const orderDetailReceive = purchaseDetailModalEl?.querySelector(".js-order-detail-receive");
    const orderDetailViewActions = purchaseDetailModalEl?.querySelector(".js-order-detail-view-actions");
    const orderDetailReceiveActions = purchaseDetailModalEl?.querySelector(".js-order-detail-receive-actions");
    const orderDetailClosedActions = purchaseDetailModalEl?.querySelector(".js-order-detail-closed-actions");
    const orderDetailReceiveBack = purchaseDetailModalEl?.querySelector(".js-order-detail-receive-back");
    const orderDetailReceiveConfirm = purchaseDetailModalEl?.querySelector(".js-order-detail-receive-confirm");
    const orderDetailClose = purchaseDetailModalEl?.querySelector(".js-order-detail-close");
    const orderDetailLogsToggle = purchaseDetailModalEl?.querySelector(".js-order-detail-logs-toggle");
    const orderDetailLogsPanel = purchaseDetailModalEl?.querySelector(".js-order-detail-logs-panel");
    const orderDetailConfirm = purchaseDetailModalEl?.querySelector(".js-order-detail-confirm");
    const orderDetailConfirmSubmit = purchaseDetailModalEl?.querySelector(".js-order-detail-confirm-submit");
    const orderDetailConfirmClose = Array.from(purchaseDetailModalEl?.querySelectorAll(".js-order-detail-confirm-close") || []);
    const filterDrawer = document.getElementById("inventoryProductFilterDrawer");
    const filterBrand = filterDrawer?.querySelector(".js-inventory-filter-brand");
    const filterCategory = filterDrawer?.querySelector(".js-inventory-filter-category");
    const filterSupplier = filterDrawer?.querySelector(".js-inventory-filter-supplier");
    const filterStock = filterDrawer?.querySelector(".js-inventory-filter-stock");
    const filterReset = filterDrawer?.querySelector(".js-inventory-filter-reset");
    const purchaseFilterDrawer = document.getElementById("inventoryPurchaseFilterDrawer");
    const purchaseFilterStatus = purchaseFilterDrawer?.querySelector(".js-inventory-purchase-filter-status");
    const purchaseFilterSupplier = purchaseFilterDrawer?.querySelector(".js-inventory-purchase-filter-supplier");
    const purchaseFilterReset = purchaseFilterDrawer?.querySelector(".js-inventory-purchase-filter-reset");
    const opnameDateModal = document.getElementById("inventoryOpnameDateFilterModal");
    const opnameDateStart = opnameDateModal?.querySelector(".js-inventory-opname-start");
    const opnameDateEnd = opnameDateModal?.querySelector(".js-inventory-opname-end");
    const opnameDateRange = opnameDateModal?.querySelector(".js-inventory-opname-date-range");
    const opnameDateReset = opnameDateModal?.querySelector(".js-inventory-opname-date-reset");
    const opnameDateApply = opnameDateModal?.querySelector(".js-inventory-opname-date-apply");
    const opnameDatePresets = Array.from(opnameDateModal?.querySelectorAll(".js-inventory-opname-date-preset") || []);
    const opnameDateModalInstance = opnameDateModal && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(opnameDateModal)
        : null;
    const importModalEl = document.getElementById("inventoryImportModal");
    const importModal = importModalEl && typeof bootstrap !== "undefined"
        ? bootstrap.Modal.getOrCreateInstance(importModalEl)
        : null;
    const importFile = importModalEl?.querySelector(".js-inventory-import-file");
    const importMeta = importModalEl?.querySelector(".js-inventory-import-meta");
    const importRun = importModalEl?.querySelector(".js-inventory-import-run");
    const templateButton = importModalEl?.querySelector(".js-inventory-template");
    const exportButtons = Array.from(productPanel?.querySelectorAll(".js-inventory-export") || []);
    const purchaseExportButtons = Array.from(purchasePanel?.querySelectorAll(".js-inventory-purchase-export") || []);
    const formatYmd = (date) => {
        const pad = (value) => String(value).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    const displayDate = (value) => {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    };
    const startOfDay = (value) => {
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    };
    const endOfDay = (value) => {
        const date = new Date(`${value}T23:59:59`);
        return Number.isNaN(date.getTime()) ? null : date;
    };
    const parseInventoryDateTime = (value) => {
        const raw = String(value || "").trim();
        if (!raw || raw === "-") {
            return null;
        }

        const isoLike = new Date(raw);
        if (!Number.isNaN(isoLike.getTime())) {
            return isoLike;
        }

        const monthMap = {
            jan: 0,
            januari: 0,
            feb: 1,
            februari: 1,
            mar: 2,
            maret: 2,
            apr: 3,
            april: 3,
            mei: 4,
            jun: 5,
            juni: 5,
            jul: 6,
            juli: 6,
            agu: 7,
            agustus: 7,
            aug: 7,
            sep: 8,
            september: 8,
            okt: 9,
            oktober: 9,
            oct: 9,
            nov: 10,
            november: 10,
            des: 11,
            desember: 11,
            dec: 11,
        };
        const match = raw.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})(?:,\s*(\d{1,2})[:.](\d{2}))?$/);
        if (!match) {
            return null;
        }

        const day = Number.parseInt(match[1], 10) || 1;
        const monthKey = match[2].toLowerCase();
        const month = monthMap[monthKey];
        const year = Number.parseInt(match[3], 10) || 1970;
        const hour = Number.parseInt(match[4] || "0", 10) || 0;
        const minute = Number.parseInt(match[5] || "0", 10) || 0;
        if (month == null) {
            return null;
        }

        return new Date(year, month, day, hour, minute, 0, 0);
    };
    let activeOpnamePreset = "7d";
    let inventoryVariantIndex = 0;
    let opnamePicker = null;
    let productModalMode = "create";
    let pendingProductDetail = null;
    let activeProductRow = null;
    let historyRowsState = [];
    let historyPage = 1;
    let historyPageSize = 10;
    let historyLocationFilter = "all";
    let historyRangeIndex = 0;
    let stockAdjustmentMode = "increase";
    let stockAdjustmentReason = "New stock";
    let activeInventoryTab = "products";
    let activeOpnameReviewRow = null;
    let activeOpnameReviewFilter = "counted";
    let activeOpnameReviewMode = "reviewing";
    let suppressOpnameDetailAutosave = false;
    let opnameDetailPersisting = false;
    let activeMasterTab = "brands";
    let purchaseOrderStep = "supplier";
    let selectedSupplierState = null;
    let selectedLocationState = null;
    let purchaseOrderItems = [];
    let purchaseOrderNoteVisible = false;
    let activePurchaseDetailRow = null;
    let pendingPurchaseDetailRow = null;
    let visibleOrderSuggestions = [];
    let purchaseDetailMode = "view";
    let activeMasterRow = null;
    let masterItemMode = "create";

    const applyTab = (tabName) => {
        activeInventoryTab = tabName;
        tabs.forEach((tab) => {
            const isActive = tab.dataset.inventoryTab === tabName;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        panels.forEach((panel) => {
            const isActive = panel.dataset.inventoryPanel === tabName;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });

        if (inventoryFab) {
            const showFab = tabName === "products" || tabName === "purchases" || tabName === "opname" || tabName === "master";
            inventoryFab.hidden = !showFab;
            inventoryFab.setAttribute("aria-expanded", "false");
        }

        if (inventoryFabIcon) {
            inventoryFabIcon.className = tabName === "purchases" ? "bi bi-plus-lg" : "bi bi-plus-lg";
        }

        if (inventoryFabMenu) {
            inventoryFabMenu.hidden = true;
            inventoryFabMenu.classList.remove("is-open");
        }
    };

    const closeInventoryFabMenu = () => {
        if (inventoryFabMenu) {
            inventoryFabMenu.hidden = true;
            inventoryFabMenu.classList.remove("is-open");
        }
        inventoryFab?.setAttribute("aria-expanded", "false");
    };

    const openInventoryFabMenu = () => {
        if (!inventoryFabMenu) return;
        inventoryFabMenu.hidden = false;
        inventoryFab?.setAttribute("aria-expanded", "true");
        window.requestAnimationFrame(() => {
            inventoryFabMenu.classList.add("is-open");
        });
    };

    const purchaseEscapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char] || char));

    const getProductCatalog = () => productRows.map((row) => ({
        id: Number(row.dataset.productId || 0),
        name: row.dataset.name || "",
        price: row.dataset.price || "Rp 0,00",
        supplier: row.dataset.supplier || "",
        code: row.dataset.code || "",
        qty: Number(row.dataset.qty || 0),
    }));

    const parseJsonData = (value, fallback = []) => {
        try {
            const parsed = JSON.parse(value || "[]");
            return Array.isArray(parsed) ? parsed : fallback;
        } catch (error) {
            return fallback;
        }
    };

    const inventoryCsrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

    const showInventoryMessage = (title, copy) => {
        if (quickTitle) quickTitle.textContent = title;
        if (quickCopy) quickCopy.textContent = copy;
        quickModal?.show();
    };

    const inventoryPost = async (url, payload = {}) => {
        const body = new URLSearchParams();
        body.append("_csrf", inventoryCsrfToken);
        Object.entries(payload).forEach(([key, value]) => {
            body.append(key, value == null ? "" : String(value));
        });

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });

        const rawText = await response.text();
        let data = {};
        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch (error) {
                data = { message: rawText };
            }
        }

        if (!response.ok || data.success === false) {
            throw new Error(data.message || `Request gagal (${response.status})`);
        }

        return data;
    };

    const inventoryFetch = async (url) => {
        const response = await fetch(url, {
            headers: {
                "Accept": "application/json",
            },
            credentials: "same-origin",
        });

        const rawText = await response.text();
        let data = {};
        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch (error) {
                data = { message: rawText };
            }
        }

        if (!response.ok || data.success === false) {
            throw new Error(data.message || `Request gagal (${response.status})`);
        }

        return data;
    };

    const handleInventoryError = (error, title = "Inventory") => {
        console.error(error);
        showInventoryMessage(title, error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan data inventory.");
    };

    const getPurchaseStatusClass = (status) => {
        const normalized = String(status || "").trim().toLowerCase();
        if (normalized === "received") return "received";
        if (normalized === "cancelled") return "cancelled";
        return "ordered";
    };

    const syncPurchaseRowData = (row, payload) => {
        if (!row) return;
        const items = Array.isArray(payload.items) ? payload.items : [];
        const receivingLogs = Array.isArray(payload.receiving_logs || payload.receivingLogs)
            ? (payload.receiving_logs || payload.receivingLogs)
            : [];
        row.dataset.purchaseId = String(payload.id || 0);
        row.dataset.order = payload.document || payload.order || "";
        row.dataset.status = payload.status || "Ordered";
        row.dataset.supplier = payload.supplier || "";
        row.dataset.location = payload.location || "";
        row.dataset.createdAt = payload.created_at || payload.createdAt || "";
        row.dataset.type = payload.type || "Order";
        row.dataset.total = payload.total || formatCurrencyValue(0);
        row.dataset.note = payload.note || "";
        row.dataset.items = JSON.stringify(items);
        row.dataset.receivingLogs = JSON.stringify(receivingLogs);
        row.innerHTML = `
            <td class="inventory-name-cell">
                <span class="inventory-row-icon"><i class="bi bi-box-seam"></i></span>
                <strong>${purchaseEscapeHtml(payload.document || payload.order || "")}</strong>
            </td>
            <td>${purchaseEscapeHtml(payload.created_at || payload.createdAt || "")}</td>
            <td>${purchaseEscapeHtml(payload.type || "Order")}</td>
            <td>${purchaseEscapeHtml(payload.supplier || "")}</td>
            <td>${purchaseEscapeHtml(payload.location || "")}</td>
            <td><span class="inventory-status inventory-status--purchase-${getPurchaseStatusClass(payload.status || "Ordered")}">${purchaseEscapeHtml(payload.status || "Ordered")}</span></td>
            <td>${purchaseEscapeHtml(payload.total || formatCurrencyValue(0))}</td>
        `;
    };

    const upsertPurchaseRow = (payload) => {
        if (!purchaseBody) return null;
        const payloadId = Number(payload.id || 0);
        let row = payloadId > 0
            ? purchaseRows.find((item) => Number(item.dataset.purchaseId || 0) === payloadId)
            : null;
        if (!row) {
            row = document.createElement("tr");
            row.setAttribute("data-inventory-purchase-row", "");
            purchaseBody.prepend(row);
            purchaseRows.unshift(row);
        }
        syncPurchaseRowData(row, payload);
        return row;
    };

    const getNextPurchaseOrderNumber = () => {
        const nextValue = purchaseRows.reduce((maxValue, row) => {
            const match = String(row.dataset.order || "").match(/^P(\d+)$/i);
            if (!match) return maxValue;
            return Math.max(maxValue, Number.parseInt(match[1], 10) || 0);
        }, 0) + 1;
        return `P${String(nextValue).padStart(6, "0")}`;
    };

    const getSupplierMetaByName = (name) => {
        const match = orderSupplierOptions.find((button) => (button.dataset.supplierName || "") === name);
        return {
            contact: match?.dataset.supplierContact || "",
            address: match?.dataset.supplierAddress || "",
        };
    };

    const getLocationMetaByName = (name) => {
        const match = orderLocationOptions.find((button) => (button.dataset.locationName || "") === name);
        return {
            address: match?.dataset.locationAddress || "",
        };
    };

    const hideOrderSuggestions = () => {
        visibleOrderSuggestions = [];
        if (orderProductSuggestions) {
            orderProductSuggestions.hidden = true;
            orderProductSuggestions.innerHTML = "";
        }
    };

    const resolveCatalogProduct = (productName) => {
        const normalizedName = String(productName || "").trim().toLowerCase();
        if (!normalizedName) return null;
        const catalog = getProductCatalog();
        return catalog.find((item) => item.name.toLowerCase() === normalizedName)
            || catalog.find((item) => item.name.toLowerCase().includes(normalizedName))
            || null;
    };

    const renderOrderSuggestions = (query = orderProductSearch?.value || "") => {
        if (!orderProductSuggestions) return;
        const normalized = String(query || "").trim().toLowerCase();
        const matches = getProductCatalog()
            .filter((item) => !normalized || item.name.toLowerCase().includes(normalized))
            .slice(0, 8);

        visibleOrderSuggestions = matches;

        if (!matches.length) {
            hideOrderSuggestions();
            return;
        }

        orderProductSuggestions.innerHTML = matches.map((item) => `
            <button class="inventory-order-suggestion js-order-product-suggestion" type="button" data-product-name="${purchaseEscapeHtml(item.name)}">
                <span>${purchaseEscapeHtml(item.name)}</span>
                <small>Stock ${purchaseEscapeHtml(String(item.qty))}</small>
            </button>
        `).join("");
        orderProductSuggestions.hidden = false;
    };

    const setPurchaseOrderStep = (step) => {
        purchaseOrderStep = step;
        orderProgressSteps.forEach((item, index) => {
            const itemStep = item.dataset.orderProgress || "supplier";
            const stepOrder = ["supplier", "location", "order"];
            const currentIndex = stepOrder.indexOf(step);
            const itemIndex = stepOrder.indexOf(itemStep);
            item.classList.toggle("is-active", itemIndex <= currentIndex);
            item.classList.toggle("is-current", itemIndex === currentIndex);
        });
        orderPanels.forEach((panel) => {
            const isActive = panel.dataset.orderPanel === step;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });
    };

    const renderPurchaseOrderSummary = () => {
        const totalValue = purchaseOrderItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
        if (orderSelectedSupplier) {
            orderSelectedSupplier.textContent = selectedSupplierState?.name || "Supplier";
        }
        if (orderSelectedSupplierMeta) {
            orderSelectedSupplierMeta.textContent = selectedSupplierState
                ? `${selectedSupplierState.contact} - ${selectedSupplierState.address}`
                : "Pilih supplier";
        }
        if (orderSelectedLocation) {
            orderSelectedLocation.textContent = selectedLocationState?.name || "Lokasi";
        }
        if (orderSelectedLocationMeta) {
            orderSelectedLocationMeta.textContent = selectedLocationState?.address || "Pilih lokasi tujuan";
        }
        if (orderTotal) {
            orderTotal.textContent = formatCurrencyValue(totalValue);
        }
        if (orderSubmitButton) {
            orderSubmitButton.disabled = purchaseOrderItems.length === 0;
        }
    };

    const renderPurchaseOrderItems = () => {
        if (!orderItemsBody) return;
        orderItemsBody.innerHTML = purchaseOrderItems.map((item, index) => `
            <tr data-order-item-index="${index}">
                <td>${purchaseEscapeHtml(item.name)}</td>
                <td><input class="js-order-item-qty" type="text" inputmode="numeric" value="${item.qty}"></td>
                <td><input class="js-order-item-price" type="text" value="${formatCurrencyValue(item.price)}"></td>
                <td>${formatCurrencyValue(item.qty * item.price)}</td>
                <td><button class="js-order-item-remove" type="button"><i class="bi bi-x-lg"></i></button></td>
            </tr>
        `).join("") || `
            <tr>
                <td colspan="5">Belum ada produk yang dipilih.</td>
            </tr>
        `;
        renderPurchaseOrderSummary();
    };

    const syncPurchaseOrderRow = (row, item, { formatPrice = false, formatQty = false } = {}) => {
        if (!(row instanceof HTMLElement) || !item) return;
        const totalCell = row.children[3];
        if (totalCell) {
            totalCell.textContent = formatCurrencyValue((item.qty || 0) * (item.price || 0));
        }
        if (formatQty) {
            const qtyInput = row.querySelector(".js-order-item-qty");
            if (qtyInput instanceof HTMLInputElement) {
                qtyInput.value = String(item.qty || 0);
            }
        }
        if (formatPrice) {
            const priceInput = row.querySelector(".js-order-item-price");
            if (priceInput instanceof HTMLInputElement) {
                priceInput.value = formatCurrencyValue(item.price || 0);
            }
        }
        renderPurchaseOrderSummary();
    };

    const resetPurchaseOrderBuilder = () => {
        selectedSupplierState = null;
        selectedLocationState = null;
        purchaseOrderItems = [];
        purchaseOrderNoteVisible = false;
        orderSupplierOptions.forEach((button) => button.classList.remove("is-active"));
        orderLocationOptions.forEach((button) => button.classList.remove("is-active"));
        if (orderNote) {
            orderNote.hidden = true;
            orderNote.value = "";
        }
        orderNoteToggle?.classList.remove("is-active");
        if (orderProductSearch) {
            orderProductSearch.value = "";
        }
        hideOrderSuggestions();
        setPurchaseOrderStep("supplier");
        renderPurchaseOrderItems();
    };

    const addPurchaseOrderItem = (productName) => {
        const normalizedName = String(productName || "").trim().toLowerCase();
        if (!normalizedName) return;
        const product = getProductCatalog().find((item) => item.name.toLowerCase() === normalizedName);
        if (!product) return;

        const existingItem = purchaseOrderItems.find((item) => item.name === product.name);
        if (existingItem) {
            existingItem.qty += 1;
        } else {
            purchaseOrderItems.push({
                productId: product.id,
                name: product.name,
                qty: 1,
                price: parseCurrencyValue(product.price),
            });
        }
        if (orderProductSearch) {
            orderProductSearch.value = "";
        }
        hideOrderSuggestions();
        renderPurchaseOrderItems();
    };

    const getPurchaseRowPayload = (row) => {
        const supplierMeta = getSupplierMetaByName(row.dataset.supplier || "");
        const locationMeta = getLocationMetaByName(row.dataset.location || "");
        const items = parseJsonData(row.dataset.items);
        const receivingLogs = parseJsonData(row.dataset.receivingLogs);
        return {
            id: Number(row.dataset.purchaseId || 0),
            order: row.dataset.order || "",
            createdAt: row.dataset.createdAt || "",
            type: row.dataset.type || "Order",
            supplier: row.dataset.supplier || "",
            supplierMeta,
            location: row.dataset.location || "",
            locationMeta,
            status: row.dataset.status || "Ordered",
            total: row.dataset.total || formatCurrencyValue(0),
            note: row.dataset.note || "",
            items,
            receivingLogs,
        };
    };

    const closePurchaseCancelConfirm = () => {
        if (orderDetailConfirm) {
            orderDetailConfirm.hidden = true;
        }
    };

    const setPurchaseDetailMode = (mode = "view") => {
        purchaseDetailMode = mode;
        if (purchaseDetailModalEl) {
            purchaseDetailModalEl.dataset.detailMode = mode;
        }
        const status = activePurchaseDetailRow?.dataset.status || "";
        const isOrderedView = mode === "view" && status === "Ordered";
        const isClosedView = mode === "view" && (status === "Cancelled" || status === "Received");
        if (orderDetailViewActions) {
            orderDetailViewActions.hidden = !isOrderedView;
        }
        if (orderDetailReceiveActions) {
            orderDetailReceiveActions.hidden = mode !== "receive";
        }
        if (orderDetailClosedActions) {
            orderDetailClosedActions.hidden = !isClosedView;
        }
        closePurchaseCancelConfirm();
    };

    const ensurePurchaseReceiveDraft = (row) => {
        if (!row) return [];
        if (!Array.isArray(row._purchaseReceiveDraft)) {
            row._purchaseReceiveDraft = parseJsonData(row.dataset.items).map((item) => ({
                name: item.name,
                qty: Number(item.qty || 0),
                price: Number(item.price || 0),
                total: Number(item.total || (Number(item.qty || 0) * Number(item.price || 0))),
                receivedQty: Number(item.receivedQty ?? item.qty ?? 0),
            }));
        }
        return row._purchaseReceiveDraft;
    };

    const syncPurchaseRowStatus = (row, status) => {
        row.dataset.status = status;
        const badge = row.querySelector(".inventory-status");
        if (badge) {
            badge.className = `inventory-status inventory-status--purchase-${getPurchaseStatusClass(status)}`;
            badge.textContent = status;
        }
    };

    const renderPurchaseDetail = (row, { mode = "view" } = {}) => {
        if (!row || !purchaseDetailModalEl) return;
        activePurchaseDetailRow = row;
        const payload = getPurchaseRowPayload(row);
        purchaseDetailModalEl.dataset.orderStatus = getPurchaseStatusClass(payload.status);
        setPurchaseDetailMode(mode);
        const showReceivedColumns = mode === "receive" || payload.status === "Received";
        purchaseDetailModalEl.dataset.detailColumns = showReceivedColumns ? "5" : "4";
        const hasNote = Boolean(String(payload.note || "").trim());

        if (orderDetailTitle) orderDetailTitle.textContent = `Order ${payload.order}`;
        if (orderDetailStatus) orderDetailStatus.textContent = payload.status;
        if (orderDetailDate) orderDetailDate.textContent = `Dipesan di ${payload.createdAt}`;
        if (orderDetailHead) {
            orderDetailHead.hidden = mode === "receive";
        }
        if (orderDetailSupplier) orderDetailSupplier.textContent = payload.supplier;
        if (orderDetailSupplierMeta) orderDetailSupplierMeta.textContent = payload.supplierMeta.contact || "-";
        if (orderDetailLocation) orderDetailLocation.textContent = payload.location;
        if (orderDetailLocationMeta) orderDetailLocationMeta.textContent = payload.locationMeta.address || "-";
        if (orderDetailTotal) orderDetailTotal.textContent = payload.total;
        if (orderDetailNote) orderDetailNote.value = payload.note || "";
        if (orderDetailNoteSection) {
            orderDetailNoteSection.hidden = !hasNote;
        }

        if (orderDetailItemsHead) {
            orderDetailItemsHead.innerHTML = showReceivedColumns
                ? `
                    <tr>
                        <th>Produk</th>
                        <th>Jumlah Order</th>
                        <th>QTY Diterima</th>
                        <th>Harga Supply</th>
                        <th>Total Biaya</th>
                    </tr>
                `
                : `
                    <tr>
                        <th>Produk</th>
                        <th>Jumlah Order</th>
                        <th>Harga Supply</th>
                        <th>Total Biaya</th>
                    </tr>
                `;
        }

        if (orderDetailItems) {
            const receiveDraft = mode === "receive" ? ensurePurchaseReceiveDraft(row) : [];
            orderDetailItems.innerHTML = payload.items.length
                ? payload.items.map((item, index) => {
                    const draftItem = receiveDraft[index] || item;
                    const qtyReceived = Number(draftItem.receivedQty ?? item.receivedQty ?? item.qty ?? 0);
                    return mode === "receive"
                        ? `
                            <tr data-order-receive-index="${index}">
                                <td>${purchaseEscapeHtml(item.name || "-")}</td>
                                <td>${purchaseEscapeHtml(String(item.qty || 0))}</td>
                                <td><input class="js-order-detail-received-qty" type="text" inputmode="numeric" value="${purchaseEscapeHtml(String(qtyReceived))}"></td>
                                <td>${formatCurrencyValue(item.price || 0)}</td>
                                <td>${formatCurrencyValue((qtyReceived || 0) * (item.price || 0))}</td>
                            </tr>
                        `
                        : showReceivedColumns
                            ? `
                                <tr>
                                    <td>${purchaseEscapeHtml(item.name || "-")}</td>
                                    <td>${purchaseEscapeHtml(String(item.qty || 0))}</td>
                                    <td>${purchaseEscapeHtml(String(qtyReceived))}</td>
                                    <td>${formatCurrencyValue(item.price || 0)}</td>
                                    <td>${formatCurrencyValue((qtyReceived || 0) * (item.price || 0))}</td>
                                </tr>
                            `
                        : `
                            <tr>
                                <td>${purchaseEscapeHtml(item.name || "-")}</td>
                                <td>${purchaseEscapeHtml(String(item.qty || 0))}</td>
                                <td>${formatCurrencyValue(item.price || 0)}</td>
                                <td>${formatCurrencyValue(item.total || ((item.qty || 0) * (item.price || 0)))}</td>
                            </tr>
                        `;
                }).join("")
                : `
                    <tr>
                        <td colspan="${showReceivedColumns ? "5" : "4"}">Belum ada item.</td>
                    </tr>
                `;
        }

        if (orderDetailLogs) {
            orderDetailLogs.innerHTML = payload.receivingLogs.length
                ? payload.receivingLogs.map((item) => `
                    <tr>
                        <td>${purchaseEscapeHtml(item.product || "-")}</td>
                        <td>${purchaseEscapeHtml(String(item.qty || 0))}</td>
                        <td>${purchaseEscapeHtml(item.date || "-")}</td>
                        <td>${formatCurrencyValue(item.price || 0)}</td>
                        <td>${formatCurrencyValue(item.total || ((item.qty || 0) * (item.price || 0)))}</td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="5">No Data</td>
                    </tr>
                `;
        }

        if (orderDetailCancel) {
            orderDetailCancel.disabled = payload.status === "Cancelled";
        }
        if (orderDetailReceive) {
            orderDetailReceive.disabled = payload.status === "Received" || payload.status === "Cancelled";
        }
        if (orderDetailEmail) {
            orderDetailEmail.hidden = payload.status !== "Ordered" || mode === "receive";
        }
        if (orderDetailPdf) {
            orderDetailPdf.hidden = payload.status === "Cancelled" || mode === "receive";
        }
        if (orderDetailTools) {
            orderDetailTools.hidden = payload.status === "Cancelled" || mode === "receive";
        }
        if (purchaseDetailModalEl) {
            purchaseDetailModalEl.dataset.logsExpanded = payload.status === "Received" ? "true" : "false";
        }
        if (orderDetailLogsToggle) {
            const expanded = payload.status === "Received";
            orderDetailLogsToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
            const icon = orderDetailLogsToggle.querySelector("i");
            if (icon) {
                icon.className = expanded ? "bi bi-chevron-up" : "bi bi-chevron-down";
            }
        }
        if (orderDetailLogsPanel) {
            orderDetailLogsPanel.hidden = payload.status !== "Received";
        }

        purchaseDetailModal?.show();
    };

    const submitPurchaseOrder = async () => {
        if (!selectedSupplierState || !selectedLocationState || purchaseOrderItems.length === 0) return;

        try {
            const response = await inventoryPost("/api/inventory/purchases/create", {
                supplier_id: selectedSupplierState.id || 0,
                location_id: selectedLocationState.id || 0,
                type: "Order",
                note: orderNote?.value || "",
                items_json: JSON.stringify(purchaseOrderItems.map((item) => ({
                    product_id: item.productId || 0,
                    name: item.name,
                    qty: item.qty,
                    price: item.price,
                }))),
            });

            const row = upsertPurchaseRow(response.row || {});
            pendingPurchaseDetailRow = row;
            applyPurchaseFilters();
            purchaseOrderModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Pesanan");
        }
    };

    const applyMasterTab = (tabName) => {
        activeMasterTab = tabName;
        masterTabs.forEach((tab) => {
            const isActive = tab.dataset.inventoryMasterTab === tabName;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        masterPanels.forEach((panel) => {
            const isActive = panel.dataset.inventoryMasterPanel === tabName;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });
    };

    const updateSimpleMasterTotal = (rows, node) => {
        if (node) {
            node.textContent = `Total ${rows.filter((row) => !row.hidden).length}`;
        }
    };

    const refreshInventoryLookupOptions = () => {
        const syncSelect = (field, placeholderLabel, rows) => {
            if (!field) return;
            const currentValue = field.value;
            const options = rows
                .map((row) => String(row.dataset.name || "").trim())
                .filter(Boolean)
                .sort((left, right) => left.localeCompare(right, "id"));
            field.innerHTML = `<option value="">${placeholderLabel}</option>${options.map((option) => `<option value="${purchaseEscapeHtml(option)}">${purchaseEscapeHtml(option)}</option>`).join("")}`;
            field.value = options.includes(currentValue) ? currentValue : "";
        };

        syncSelect(productBrandInput, "Pilih", brandRows);
        syncSelect(filterBrand, "Semua merk", brandRows);
        syncSelect(productCategoryInput, "Masukkan kata kunci", categoryRows);
        syncSelect(filterCategory, "Semua kategori", categoryRows);
        syncSelect(filterSupplier, "Semua supplier", supplierRows);
        syncSelect(purchaseFilterSupplier, "Semua supplier", supplierRows);

        if (orderSupplierGrid) {
            orderSupplierGrid.innerHTML = "";
            orderSupplierOptions.length = 0;
            supplierRows
                .slice()
                .sort((left, right) => String(left.dataset.name || "").localeCompare(String(right.dataset.name || ""), "id"))
                .forEach((row) => {
                    const button = document.createElement("button");
                    button.className = "inventory-order-pick-card js-order-supplier-option";
                    button.type = "button";
                    button.dataset.supplierId = row.dataset.id || "0";
                    button.dataset.supplierName = row.dataset.name || "";
                    button.dataset.supplierContact = row.dataset.contact || "";
                    button.dataset.supplierAddress = row.dataset.address || "";
                    button.innerHTML = `
                        <strong>${purchaseEscapeHtml(row.dataset.name || "")}</strong>
                        <span>${purchaseEscapeHtml(row.dataset.contact || "")}</span>
                        <small>${purchaseEscapeHtml(row.dataset.address || "")}</small>
                    `;
                    bindOrderSupplierOption(button);
                    orderSupplierGrid.appendChild(button);
                    orderSupplierOptions.push(button);
                });
        }
    };

    const resetMasterItemModal = () => {
        activeMasterRow = null;
        masterItemMode = "create";
        if (masterItemName) masterItemName.value = "";
        if (masterItemDelete) masterItemDelete.hidden = true;
    };

    const openMasterItemModal = (type, row = null) => {
        activeMasterRow = row;
        masterItemMode = row ? "edit" : "create";
        const label = type === "categories" ? "Kategori" : "Merk";
        if (masterItemModalEl) {
            masterItemModalEl.dataset.masterType = type;
        }
        if (masterItemTitle) {
            masterItemTitle.textContent = `${row ? "Edit" : "Tambah"} ${label}`;
        }
        if (masterItemName) {
            masterItemName.value = row?.dataset.name || "";
        }
        if (masterItemDelete) {
            masterItemDelete.hidden = !row;
        }
        masterItemModal?.show();
    };

    const buildSimpleMasterRow = (type, payload) => {
        const row = document.createElement("tr");
        row.setAttribute(type === "categories" ? "data-inventory-category-row" : "data-inventory-brand-row", "");
        row.dataset.id = String(payload.id || 0);
        row.dataset.name = payload.name || "";
        row.innerHTML = `<td class="inventory-simple-cell">${purchaseEscapeHtml(payload.name || "")}</td>`;
        return row;
    };

    const saveMasterItem = async () => {
        const type = masterItemModalEl?.dataset.masterType || "brands";
        const name = String(masterItemName?.value || "").trim();
        if (!name) return;

        const rows = type === "categories" ? categoryRows : brandRows;
        const panel = type === "categories" ? categoryPanel : brandPanel;
        const totalNode = type === "categories" ? categoryTotal : brandTotal;
        const tbody = panel?.querySelector("tbody");
        if (!tbody) return;

        try {
            const response = await inventoryPost("/api/inventory/master/save", {
                type,
                id: activeMasterRow?.dataset.id || "",
                name,
            });
            const payload = response.row || { id: 0, name };
            const matchedRow = activeMasterRow || rows.find((row) => Number(row.dataset.id || 0) === Number(payload.id || 0));

            if (matchedRow) {
                matchedRow.dataset.id = String(payload.id || 0);
                matchedRow.dataset.name = payload.name || "";
                const cell = matchedRow.querySelector("td");
                if (cell) cell.textContent = payload.name || "";
            } else {
                const row = buildSimpleMasterRow(type, payload);
                tbody.prepend(row);
                rows.unshift(row);
            }

            refreshInventoryLookupOptions();
            if (type === "categories") {
                applyCategoryFilters();
            } else {
                applyBrandFilters();
            }
            updateSimpleMasterTotal(rows, totalNode);
            masterItemModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Master Data");
        }
    };

    const deleteMasterItem = async () => {
        const type = masterItemModalEl?.dataset.masterType || "brands";
        if (!activeMasterRow) return;
        const rows = type === "categories" ? categoryRows : brandRows;
        const totalNode = type === "categories" ? categoryTotal : brandTotal;
        try {
            await inventoryPost("/api/inventory/master/delete", {
                type,
                id: activeMasterRow.dataset.id || "",
            });
            const index = rows.indexOf(activeMasterRow);
            if (index >= 0) rows.splice(index, 1);
            activeMasterRow.remove();
            refreshInventoryLookupOptions();
            updateSimpleMasterTotal(rows, totalNode);
            masterItemModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Master Data");
        }
    };

    const resetSupplierModal = () => {
        activeMasterRow = null;
        masterItemMode = "create";
        [supplierModalName, supplierModalDescription, supplierModalContact, supplierModalEmail, supplierModalPhone, supplierModalWebsite, supplierModalAddress, supplierModalCity, supplierModalCountry, supplierModalPostal].forEach((field) => {
            if (field) field.value = "";
        });
        if (supplierModalDelete) supplierModalDelete.hidden = true;
    };

    const openSupplierModal = (row = null) => {
        activeMasterRow = row;
        masterItemMode = row ? "edit" : "create";
        if (supplierModalTitle) {
            supplierModalTitle.textContent = `${row ? "Edit" : "Tambah"} Supplier`;
        }
        if (supplierModalName) supplierModalName.value = row?.dataset.name || "";
        if (supplierModalDescription) supplierModalDescription.value = row?.dataset.description || "";
        if (supplierModalContact) supplierModalContact.value = row?.dataset.contact || "";
        if (supplierModalEmail) supplierModalEmail.value = row?.dataset.email || "";
        if (supplierModalPhone) supplierModalPhone.value = row?.dataset.phone || "";
        if (supplierModalWebsite) supplierModalWebsite.value = row?.dataset.website || "";
        if (supplierModalAddress) supplierModalAddress.value = row?.dataset.address || "";
        if (supplierModalCity) supplierModalCity.value = row?.dataset.city || "";
        if (supplierModalCountry) supplierModalCountry.value = row?.dataset.country || "";
        if (supplierModalPostal) supplierModalPostal.value = row?.dataset.postal || "";
        if (supplierModalDelete) supplierModalDelete.hidden = !row;
        supplierModal?.show();
    };

    const syncSupplierRow = (row, data) => {
        row.dataset.id = String(data.id || row.dataset.id || 0);
        row.dataset.name = data.name;
        row.dataset.description = data.description;
        row.dataset.contact = data.contact;
        row.dataset.email = data.email;
        row.dataset.phone = data.phone;
        row.dataset.website = data.website;
        row.dataset.address = data.address;
        row.dataset.city = data.city;
        row.dataset.country = data.country;
        row.dataset.postal = data.postal;
        row.innerHTML = `
            <td class="inventory-simple-cell">${purchaseEscapeHtml(data.name)}</td>
            <td>${purchaseEscapeHtml(data.contact || "-")}</td>
            <td>${purchaseEscapeHtml(data.address || "-")}</td>
        `;
    };

    const saveSupplierItem = async () => {
        const data = {
            name: String(supplierModalName?.value || "").trim(),
            description: String(supplierModalDescription?.value || "").trim(),
            contact: String(supplierModalContact?.value || "").trim(),
            email: String(supplierModalEmail?.value || "").trim(),
            phone: String(supplierModalPhone?.value || "").trim(),
            website: String(supplierModalWebsite?.value || "").trim(),
            address: String(supplierModalAddress?.value || "").trim(),
            city: String(supplierModalCity?.value || "").trim(),
            country: String(supplierModalCountry?.value || "").trim(),
            postal: String(supplierModalPostal?.value || "").trim(),
        };
        if (!data.name) return;
        if (!supplierBody) return;

        try {
            const response = await inventoryPost("/api/inventory/suppliers/save", {
                id: activeMasterRow?.dataset.id || "",
                name: data.name,
                description: data.description,
                contact: data.contact,
                email: data.email,
                phone: data.phone,
                website: data.website,
                address: data.address,
                city: data.city,
                country: data.country,
                postal: data.postal,
            });
            const payload = response.row || data;

            if (activeMasterRow) {
                syncSupplierRow(activeMasterRow, payload);
            } else {
                const row = document.createElement("tr");
                row.setAttribute("data-inventory-supplier-row", "");
                syncSupplierRow(row, payload);
                supplierBody.prepend(row);
                supplierRows.unshift(row);
            }

            refreshInventoryLookupOptions();
            applySupplierFilters();
            updateSimpleMasterTotal(supplierRows, supplierTotal);
            supplierModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Supplier");
        }
    };

    const deleteSupplierItem = async () => {
        if (!activeMasterRow) return;
        try {
            await inventoryPost("/api/inventory/suppliers/delete", {
                id: activeMasterRow.dataset.id || "",
            });
            const index = supplierRows.indexOf(activeMasterRow);
            if (index >= 0) supplierRows.splice(index, 1);
            activeMasterRow.remove();
            refreshInventoryLookupOptions();
            updateSimpleMasterTotal(supplierRows, supplierTotal);
            supplierModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Supplier");
        }
    };

    const closeDrawer = (drawer) => {
        if (!drawer) return;
        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
        window.setTimeout(() => {
            if (!drawer.classList.contains("is-open")) {
                drawer.hidden = true;
            }
        }, 180);
    };

    const openDrawer = (drawer) => {
        if (!drawer) return;
        drawer.hidden = false;
        drawer.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => {
            drawer.classList.add("is-open");
        });
    };

    const applyProductModalTab = (tabName) => {
        productModalTabs.forEach((tab) => {
            const isActive = tab.dataset.inventoryProductTab === tabName;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        productModalPanels.forEach((panel) => {
            const isActive = panel.dataset.inventoryProductPanel === tabName;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });
    };

    const parseCurrencyValue = (value) => Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10) || 0;
    const formatCurrencyValue = (value) => `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
    const formatQuantityValue = (value) => Number(value || 0).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const setProductModalMode = (mode) => {
        productModalMode = mode;
        const isEdit = mode === "edit";

        if (productModalTabsWrap) {
            productModalTabsWrap.hidden = !isEdit;
        }

        if (productModalTitle) {
            productModalTitle.textContent = isEdit ? "Edit Produk" : "Product Baru";
        }

        if (productSaveButton) {
            productSaveButton.textContent = "Simpan";
        }

        if (productCancelButton) {
            productCancelButton.textContent = "Batal";
        }

        applyProductModalTab(isEdit ? "history" : "details");
    };

    const historyRangePresets = [
        { label: "30 hari sebelumnya", value: "29 Mar 2026 - 28 Apr 2026" },
        { label: "7 hari sebelumnya", value: "22 Apr 2026 - 28 Apr 2026" },
        { label: "Hari ini", value: "28 Apr 2026 - 28 Apr 2026" },
    ];
    const stockAdjustmentReasonSets = {
        increase: ["New stock", "Adjustment", "Transfer", "Return", "Other"],
        decrease: ["Other", "Internal", "Damage", "Out of date", "Lost"],
    };

    const getSelectedLocationLabels = () => productLocationItems
        .map((item) => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            return checkbox?.checked ? String(item.dataset.locationLabel || "").trim() : "";
        })
        .filter(Boolean);

    const closeHistoryLocationMenu = () => {
        if (historyLocationMenu) {
            historyLocationMenu.hidden = true;
        }
        historyLocationToggle?.setAttribute("aria-expanded", "false");
    };

    const closeStockAdjustmentModal = () => {
        if (stockAdjustmentLayer) {
            stockAdjustmentLayer.hidden = true;
        }
    };

    const syncStockAdjustmentNote = () => {
        const isOther = stockAdjustmentReason === "Other";
        if (stockAdjustmentNoteField) {
            stockAdjustmentNoteField.hidden = !isOther;
        }
        if (!isOther && stockAdjustmentNote) {
            stockAdjustmentNote.value = "";
        }
    };

    const renderStockAdjustmentReasons = () => {
        if (!stockAdjustmentReasons) return;
        const reasons = stockAdjustmentReasonSets[stockAdjustmentMode] || stockAdjustmentReasonSets.increase;
        stockAdjustmentReasons.innerHTML = reasons.map((reason) => `
            <button
                class="${reason === stockAdjustmentReason ? "is-active" : ""}"
                type="button"
                data-stock-adjustment-reason="${purchaseEscapeHtml(reason)}"
            >${purchaseEscapeHtml(reason)}</button>
        `).join("");
        syncStockAdjustmentNote();
    };

    const normalizeStockAdjustmentQty = ({ writeBack = true } = {}) => {
        const currentQty = Math.max(0, Number(pendingProductDetail?.qty || 0));
        const digits = String(stockAdjustmentQty?.value || "").replace(/[^\d]/g, "");
        const rawValue = Number.parseInt(digits, 10) || 1;
        const nextValue = stockAdjustmentMode === "decrease"
            ? Math.max(1, Math.min(rawValue, Math.max(1, currentQty)))
            : Math.max(1, rawValue);
        if (stockAdjustmentQty && writeBack) {
            stockAdjustmentQty.value = String(nextValue);
        }
        return nextValue;
    };

    const openStockAdjustmentModal = (mode) => {
        if (!pendingProductDetail || !stockAdjustmentLayer) return;
        stockAdjustmentMode = mode === "decrease" ? "decrease" : "increase";
        stockAdjustmentReason = stockAdjustmentMode === "increase" ? "New stock" : "Other";
        if (stockAdjustmentTitle) {
            stockAdjustmentTitle.textContent = stockAdjustmentMode === "increase" ? "Tambah Stok" : "Kurangi Stok";
        }
        if (stockAdjustmentQtyLabel) {
            stockAdjustmentQtyLabel.textContent = stockAdjustmentMode === "increase" ? "QTY Tambah Stok" : "QTY Kurangi Stok";
        }
        if (stockAdjustmentSummary) {
            stockAdjustmentSummary.classList.toggle("is-decrease", stockAdjustmentMode === "decrease");
            stockAdjustmentSummary.classList.toggle("is-increase", stockAdjustmentMode !== "decrease");
        }
        if (stockAdjustmentLocation) {
            stockAdjustmentLocation.textContent = historyLocationFilter === "all" ? "Star Salon" : historyLocationFilter;
        }
        if (stockAdjustmentCurrent) {
            stockAdjustmentCurrent.textContent = String(Math.max(0, Number(pendingProductDetail.qty || 0)));
        }
        if (stockAdjustmentQty) {
            stockAdjustmentQty.value = "1";
        }
        if (stockAdjustmentPriceField) {
            stockAdjustmentPriceField.hidden = stockAdjustmentMode === "decrease";
        }
        if (stockAdjustmentPrice) {
            stockAdjustmentPrice.value = stockAdjustmentMode === "increase"
                ? formatCurrencyValue(parseCurrencyValue(pendingProductDetail.price || 0))
                : "Rp 0,00";
        }
        renderStockAdjustmentReasons();
        stockAdjustmentLayer.hidden = false;
    };

    const updateHistoryRangeCopy = () => {
        const preset = historyRangePresets[historyRangeIndex] || historyRangePresets[0];
        if (historyRangeLabel) historyRangeLabel.textContent = preset.label;
        if (historyRangeValue) historyRangeValue.textContent = preset.value;
    };

    const renderHistoryRows = () => {
        if (!historyBody) return;

        const filteredRows = historyRowsState.filter((row) => historyLocationFilter === "all" || row.location === historyLocationFilter);
        const totalPages = Math.max(1, Math.ceil(filteredRows.length / historyPageSize));
        historyPage = Math.min(historyPage, totalPages);
        const startIndex = (historyPage - 1) * historyPageSize;
        const visibleRows = filteredRows.slice(startIndex, startIndex + historyPageSize);

        historyBody.innerHTML = visibleRows.map((row) => `
            <tr>
                <td>${row.date}<br>${row.time}</td>
                <td>${row.staffPrimary}<br>${row.staffSecondary}</td>
                <td>${row.location}</td>
                <td>${row.action}</td>
                <td class="js-inventory-product-history-row-qty">${formatQuantityValue(row.delta)}</td>
                <td class="js-inventory-product-history-row-cost">${formatCurrencyValue(row.cost).replace("Rp ", "")}</td>
                <td class="js-inventory-product-history-row-real">${formatQuantityValue(row.realQty)}</td>
            </tr>
        `).join("") || `
            <tr>
                <td colspan="7">Belum ada riwayat stock untuk filter ini.</td>
            </tr>
        `;

        if (historyTotal) {
            historyTotal.textContent = `Total ${filteredRows.length}`;
        }
        if (historyCurrentPage) {
            historyCurrentPage.textContent = String(historyPage);
        }
        if (historyGotoButton) {
            historyGotoButton.textContent = String(historyPage);
        }
        if (historyPageSizeLabel) {
            historyPageSizeLabel.textContent = `${historyPageSize}/page`;
        }
        if (historyPrevButton) {
            historyPrevButton.disabled = historyPage <= 1;
        }
        if (historyNextButton) {
            historyNextButton.disabled = historyPage >= totalPages;
        }
    };

    const syncHistorySummary = (product) => {
        const qtyValue = Number(product?.qty || 0);
        const priceValue = parseCurrencyValue(product?.price || 0);
        const totalCost = qtyValue * priceValue;
        const selectedLocations = getSelectedLocationLabels();
        const locationLabel = historyLocationFilter === "all"
            ? `Semua Lokasi (${selectedLocations.length || 1})`
            : `${historyLocationFilter} (${qtyValue})`;

        if (productHistoryName) productHistoryName.textContent = product?.name || "Produk";
        if (productHistoryTotalCost) productHistoryTotalCost.textContent = formatCurrencyValue(totalCost);
        if (productHistoryAverageCost) productHistoryAverageCost.textContent = formatCurrencyValue(priceValue);
        if (productHistoryLocation) productHistoryLocation.textContent = locationLabel;
        if (productHistoryQty) productHistoryQty.textContent = String(qtyValue);
    };

    const ensureRowHistory = (row, fallbackProduct) => {
        if (!row) return [];
        if (!Array.isArray(row._inventoryHistory) || row._inventoryHistory.length === 0) {
            const qtyValue = Number(row.dataset.qty || fallbackProduct?.qty || 0);
            const priceValue = parseCurrencyValue(row.dataset.price || fallbackProduct?.price || "Rp 0");
            row._inventoryHistory = [{
                date: "28 April 2026",
                time: "15:39:51",
                staffPrimary: "Rayhan Doni",
                staffSecondary: "Pramana",
                location: "Star Salon",
                action: "New stock",
                delta: qtyValue,
                cost: priceValue,
                realQty: qtyValue,
            }];
        }
        return row._inventoryHistory;
    };

    const loadProductHistory = async (row, product) => {
        if (!row) return;
        const productId = Number(row.dataset.productId || 0);
        if (productId <= 0) {
            historyRowsState = ensureRowHistory(row, product);
            syncHistorySummary(product);
            renderHistoryRows();
            return;
        }

        try {
            const response = await inventoryFetch(`/api/inventory/products/history?id=${productId}`);
            row._inventoryHistory = Array.isArray(response.rows) ? response.rows : [];
            row.dataset.historyLoaded = "true";
            if (activeProductRow === row && pendingProductDetail) {
                historyRowsState = ensureRowHistory(row, pendingProductDetail);
                syncHistorySummary(pendingProductDetail);
                renderHistoryRows();
            }
        } catch (error) {
            handleInventoryError(error, "Riwayat Stok");
        }
    };

    const appendHistoryEntry = ({ mode, qty, cost, reason, note }) => {
        if (!pendingProductDetail || !activeProductRow) return;
        const direction = mode === "decrease" ? "decrease" : "increase";
        const parsedQty = Math.max(1, Number(qty || 1));
        const previousQty = Math.max(0, Number(pendingProductDetail.qty || 0));
        const actualDelta = direction === "decrease"
            ? -Math.min(parsedQty, previousQty)
            : parsedQty;
        const currentQty = Math.max(0, previousQty + actualDelta);
        const now = new Date();
        const actionLabel = String(reason || (direction === "increase" ? "New stock" : "Other")).trim() || (direction === "increase" ? "New stock" : "Other");
        const actionText = note ? `${actionLabel}: ${note}` : actionLabel;
        const priceValue = direction === "increase"
            ? Math.max(0, Number(cost || 0))
            : 0;

        pendingProductDetail.qty = currentQty;
        activeProductRow.dataset.qty = String(currentQty);
        const qtyCell = activeProductRow.children[3];
        if (qtyCell) {
            qtyCell.textContent = String(currentQty);
        }

        historyRowsState.unshift({
            date: now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
            time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            staffPrimary: "Codex",
            staffSecondary: "Editor",
            location: historyLocationFilter === "all" ? "Star Salon" : historyLocationFilter,
            action: actionText,
            delta: actualDelta,
            cost: priceValue,
            realQty: currentQty,
        });

        activeProductRow._inventoryHistory = historyRowsState;
        syncHistorySummary(pendingProductDetail);
        renderHistoryRows();
        updateProductSaveState();
    };

    const saveProductChanges = async () => {
        if (!pendingProductDetail && !activeProductRow && productModalMode !== "create") return;

        const selectedLocations = getSelectedLocationLabels();
        const nameValue = String(productNameInput?.value || "").trim();
        const categoryValue = String(productCategoryInput?.value || "").trim();
        const brandValue = String(productBrandInput?.value || "").trim();
        const descriptionValue = String(productDescriptionInput?.value || "").trim();
        const variantCard = variantList?.querySelector(".js-inventory-variant-card");
        const priceInputValue = variantCard?.querySelectorAll("input")[1]?.value || pendingProductDetail?.price || "Rp 0,00";
        const defaultDetail = pendingProductDetail || {
            name: "",
            brand: "",
            category: "",
            supplier: "",
            type: "consumable",
            typeLabel: "Konsumsi",
            unitAll: "pcs",
            usedIn: [],
            usedInCount: 0,
            price: "Rp 0",
            qty: 0,
            status: "Aktif",
            code: "",
        };

        try {
            const response = await inventoryPost("/api/inventory/products/save", {
                id: activeProductRow?.dataset.productId || 0,
                name: nameValue,
                category: categoryValue,
                brand: brandValue,
                price: parseCurrencyValue(priceInputValue || 0),
                status: productSalesToggle?.checked ? "Aktif" : "Nonaktif",
            });
            const product = response.product || {};
            const normalizedProduct = {
                ...defaultDetail,
                ...product,
                name: product.name || nameValue || defaultDetail.name,
                category: product.category || categoryValue || defaultDetail.category,
                brand: product.brand || brandValue || defaultDetail.brand,
                price: product.price || formatCurrencyValue(parseCurrencyValue(priceInputValue || 0)),
                qty: Number(product.qty ?? defaultDetail.qty ?? 0),
                status: product.status || (productSalesToggle?.checked ? "Aktif" : "Nonaktif"),
                usedIn: selectedLocations,
                usedInCount: selectedLocations.length,
                description: descriptionValue,
            };

            pendingProductDetail = normalizedProduct;
            if (!activeProductRow) {
                if (!productBody) return;
                activeProductRow = document.createElement("tr");
                activeProductRow.setAttribute("data-inventory-row", "");
                productBody.prepend(activeProductRow);
                productRows.unshift(activeProductRow);
            }

            activeProductRow.dataset.productId = String(product.id || activeProductRow.dataset.productId || 0);
            activeProductRow.dataset.name = normalizedProduct.name;
            activeProductRow.dataset.code = product.code || product.sku || normalizedProduct.code || "-";
            activeProductRow.dataset.brand = normalizedProduct.brand;
            activeProductRow.dataset.category = normalizedProduct.category;
            activeProductRow.dataset.supplier = product.supplier || normalizedProduct.supplier || "-";
            activeProductRow.dataset.type = product.type || normalizedProduct.type || "";
            activeProductRow.dataset.typeLabel = product.type_label || normalizedProduct.typeLabel || "";
            activeProductRow.dataset.unitRetail = product.unit_retail || normalizedProduct.unitRetail || "";
            activeProductRow.dataset.unitConsumption = product.unit_consumption || normalizedProduct.unitConsumption || "";
            activeProductRow.dataset.unitAll = product.unit_all || normalizedProduct.unitAll || "";
            activeProductRow.dataset.usedIn = selectedLocations.join("|");
            activeProductRow.dataset.usedInCount = String(selectedLocations.length);
            activeProductRow.dataset.price = normalizedProduct.price;
            activeProductRow.dataset.qty = String(normalizedProduct.qty);
            activeProductRow.dataset.status = normalizedProduct.status;
            activeProductRow.dataset.stockState = normalizedProduct.qty > 0 ? "available" : "empty";
            activeProductRow.dataset.description = descriptionValue;
            activeProductRow.innerHTML = `
                <td class="inventory-name-cell">
                    <span class="inventory-row-icon"><i class="bi bi-bag"></i></span>
                    <button class="inventory-name-button js-inventory-product-open" type="button">${purchaseEscapeHtml(normalizedProduct.name)}</button>
                </td>
                <td>${purchaseEscapeHtml(activeProductRow.dataset.code)}</td>
                <td>${purchaseEscapeHtml(normalizedProduct.price)}</td>
                <td>${purchaseEscapeHtml(String(normalizedProduct.qty))}</td>
            `;

            activeProductRow._inventoryHistory = historyRowsState;
            applyProductFilters();
            productModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Produk");
        }
    };

    const updateProductSaveState = () => {
        const canSave = String(productNameInput?.value || "").trim().length > 0;
        if (productSaveButton) {
            productSaveButton.disabled = !canSave;
            productSaveButton.classList.toggle("customer-footer-btn--disabled", !canSave);
        }
    };

    const updateProductSalesNote = () => {
        const isActive = Boolean(productSalesToggle?.checked);
        productSalesNote?.classList.toggle("is-active", isActive);
        if (productSalesNoteLabel) {
            productSalesNoteLabel.textContent = isActive
                ? "Produk ini akan muncul di checkout dan penjualan"
                : "Aktifkan untuk menjual produk ini di checkout";
        }
    };

    const updateVariantNameState = (card) => {
        if (!card) return;
        const input = card.querySelector(".js-inventory-variant-name");
        const error = card.querySelector(".js-inventory-variant-error");
        const hasValue = String(input?.value || "").trim().length > 0;
        input?.classList.toggle("is-invalid", !hasValue);
        if (error) {
            error.hidden = hasValue;
        }
    };

    const closeVariantConfirms = (exceptCard = null) => {
        variantList?.querySelectorAll(".js-inventory-variant-confirm").forEach((node) => {
            if (!exceptCard || !exceptCard.contains(node)) {
                node.hidden = true;
            }
        });
    };

    const createVariantCard = () => {
        if (!variantTemplate) return null;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = variantTemplate.innerHTML.replace(/__INDEX__/g, String(++inventoryVariantIndex)).trim();
        return wrapper.firstElementChild;
    };

    const appendVariantCard = ({ focus = false } = {}) => {
        const card = createVariantCard();
        if (!card || !variantList) return;
        variantList.appendChild(card);
        updateVariantNameState(card);
        if (focus) {
            card.querySelector(".js-inventory-variant-name")?.focus();
        }
    };

    const setSelectValue = (field, value) => {
        if (!field) return;
        const targetValue = String(value || "");
        const match = Array.from(field.options).find((option) => option.value === targetValue);
        field.value = match ? targetValue : "";
    };

    const hydrateVariantCard = (card, product) => {
        if (!card || !product) return;
        const inputs = card.querySelectorAll("input");
        const variantName = card.querySelector(".js-inventory-variant-name");
        const stockChip = card.querySelectorAll(".inventory-variant-chip strong")[0];
        const locationChip = card.querySelectorAll(".inventory-variant-chip strong")[1];
        const doneButton = card.querySelector(".inventory-variant-card__done");

        if (variantName) variantName.value = product.name || "";
        if (inputs[1]) inputs[1].value = product.price || "Rp 0,00";
        if (inputs[2]) inputs[2].value = product.qty > 0 ? product.price : "Rp 0,00";
        if (inputs[3]) inputs[3].value = product.code || "";
        if (inputs[4]) inputs[4].value = `${String(product.code || "SKU").replace(/[^A-Z0-9]+/gi, "-").toUpperCase()}-${String(product.brand || "BR").slice(0, 2).toUpperCase()}`;
        if (stockChip) stockChip.textContent = `${product.status || "Aktif"} • ${product.qty || 0} ${product.unitAll || "pcs"}`;
        if (stockChip) stockChip.textContent = `${product.status || "Aktif"} - ${product.qty || 0} ${product.unitAll || "pcs"}`;
        if (locationChip) locationChip.textContent = product.usedInCount > 0
            ? `Dipakai di ${product.usedInCount} layanan`
            : "Semua lokasi punya harga sama";
        if (doneButton) doneButton.textContent = "Aktif";
        updateVariantNameState(card);
    };

    const populateProductModal = (product) => {
        if (!productModalEl || !product) return;
        setProductModalMode("edit");
        historyPage = 1;
        historyLocationFilter = "all";
        if (productSectionTitle) productSectionTitle.textContent = "Detail Produk";
        if (productNameInput) productNameInput.value = product.name || "";
        setSelectValue(productCategoryInput, product.category);
        setSelectValue(productBrandInput, product.brand);
        historyRowsState = activeProductRow ? ensureRowHistory(activeProductRow, product) : [];
        if (productDescriptionInput) {
            const parts = [
                product.typeLabel ? `Tipe: ${product.typeLabel}` : "",
                product.unitAll ? `Unit: ${product.unitAll}` : "",
                product.supplier ? `Supplier: ${product.supplier}` : "",
                product.usedInCount > 0 ? `Dipakai di ${product.usedInCount} layanan: ${product.usedIn.join(", ")}` : "Belum dipakai di layanan mana pun.",
            ].filter(Boolean);
            productDescriptionInput.value = parts.join("\n");
        }
        if (productSalesToggle) {
            productSalesToggle.checked = String(product.status || "").toLowerCase() !== "nonaktif";
        }
        if (productPhotoCopy) {
            productPhotoCopy.innerHTML = `<strong>${product.brand || "Produk"}</strong> · ${product.category || "Kategori"} · ${product.code || "Kode"}`;
        }
        if (productPhotoHelp) {
            productPhotoHelp.textContent = `Status ${product.status || "Aktif"} • stok ${product.qty || 0} • supplier ${product.supplier || "-"}`;
        }
        if (productPhotoCopy) {
            productPhotoCopy.innerHTML = `<strong>${product.brand || "Produk"}</strong> - ${product.category || "Kategori"} - ${product.code || "Kode"}`;
        }
        if (productPhotoHelp) {
            productPhotoHelp.textContent = `Status ${product.status || "Aktif"} - stok ${product.qty || 0} - supplier ${product.supplier || "-"}`;
        }
        if (variantList) {
            variantList.innerHTML = "";
            const card = createVariantCard();
            if (card) {
                variantList.appendChild(card);
                hydrateVariantCard(card, product);
            }
        }
        historyLocationOptions.forEach((option) => {
            option.classList.toggle("is-active", option.dataset.historyLocation === "all");
        });
        updateHistoryRangeCopy();
        syncHistorySummary(product);
        renderHistoryRows();
        closeHistoryLocationMenu();
        if (productSaveButton) {
            productSaveButton.textContent = "Simpan";
        }
        if (productCancelButton) {
            productCancelButton.textContent = "Batal";
        }
        updateProductSalesNote();
        updateProductSaveState();
    };

    const resetProductModal = () => {
        if (!productModalEl) return;
        applyProductModalTab("details");
        historyPage = 1;
        historyPageSize = 10;
        historyLocationFilter = "all";
        historyRangeIndex = 0;
        historyRowsState = [];
        activeProductRow = null;
        productModalEl.querySelectorAll('select').forEach((field) => {
            field.selectedIndex = 0;
        });
        productModalEl.querySelectorAll('textarea').forEach((field) => {
            field.value = "";
        });
        productModalEl.querySelectorAll('input[type="text"], input[type="search"]').forEach((field) => {
            field.value = "";
        });
        productModalEl.querySelectorAll('input[type="file"]').forEach((field) => {
            field.value = "";
        });
        if (productModalTitle) productModalTitle.textContent = "Product Baru";
        if (productSectionTitle) productSectionTitle.textContent = "Detail Produk";
        if (productSalesToggle) {
            productSalesToggle.checked = false;
        }
        productLocationItems.forEach((item) => {
            item.hidden = false;
            const checkbox = item.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = true;
        });
        if (variantList) {
            variantList.innerHTML = "";
        }
        if (productPhotoCopy) {
            productPhotoCopy.innerHTML = "Drop file here or <strong>click to upload</strong>";
        }
        if (productPhotoHelp) {
            productPhotoHelp.textContent = "Use HD Photos (1920 x 1080 px) for best user experience";
        }
        if (productHistoryName) productHistoryName.textContent = "Hair Serum Wardah - Per Pump";
        if (productHistoryTotalCost) productHistoryTotalCost.textContent = "Rp 0";
        if (productHistoryAverageCost) productHistoryAverageCost.textContent = "Rp 0";
        if (productHistoryLocation) productHistoryLocation.textContent = "Star Salon (10)";
        if (productHistoryQty) productHistoryQty.textContent = "10";
        if (productHistoryRowQty) productHistoryRowQty.textContent = "10.00";
        if (productHistoryRowCost) productHistoryRowCost.textContent = "0,00";
        if (productHistoryRowReal) productHistoryRowReal.textContent = "10.00";
        updateHistoryRangeCopy();
        renderHistoryRows();
        closeHistoryLocationMenu();
        closeStockAdjustmentModal();
        if (stockAdjustmentNote) {
            stockAdjustmentNote.value = "";
        }
        if (productSaveButton) {
            productSaveButton.textContent = "Simpan";
        }
        if (productCancelButton) {
            productCancelButton.textContent = "Batal";
        }
        inventoryVariantIndex = 0;
        setProductModalMode("create");
        updateProductSalesNote();
        updateProductSaveState();
    };

    const applyProductFilters = () => {
        if (!productPanel) return;
        const query = String(productSearch?.value || "").trim().toLowerCase();
        const brand = filterBrand?.value || "";
        const category = filterCategory?.value || "";
        const supplier = filterSupplier?.value || "";
        const stock = filterStock?.value || "";
        let visible = 0;

        productRows.forEach((row) => {
            const matchesQuery = !query || String(row.textContent || "").toLowerCase().includes(query);
            const matchesBrand = !brand || row.dataset.brand === brand;
            const matchesCategory = !category || row.dataset.category === category;
            const matchesSupplier = !supplier || row.dataset.supplier === supplier;
            const matchesStock = !stock || row.dataset.stockState === stock;
            const show = matchesQuery && matchesBrand && matchesCategory && matchesSupplier && matchesStock;
            row.hidden = !show;
            if (show) visible += 1;
        });

        if (productTotal) {
            productTotal.textContent = `Total ${visible}`;
        }
    };

    const applyPurchaseFilters = () => {
        if (!purchasePanel) return;
        const query = String(purchaseSearch?.value || "").trim().toLowerCase();
        const status = purchaseFilterStatus?.value || "";
        const supplier = purchaseFilterSupplier?.value || "";
        const location = purchaseLocationToggle?.dataset.locationValue || "";
        let visible = 0;

        purchaseRows.forEach((row) => {
            const matchesQuery = !query || String(row.textContent || "").toLowerCase().includes(query);
            const matchesStatus = !status || row.dataset.status === status;
            const matchesSupplier = !supplier || row.dataset.supplier === supplier;
            const matchesLocation = !location || row.dataset.location === location;
            const show = matchesQuery && matchesStatus && matchesSupplier && matchesLocation;
            row.hidden = !show;
            if (show) visible += 1;
        });

        if (purchaseTotal) {
            purchaseTotal.textContent = `Total ${visible}`;
        }
    };

    const applyOpnameRangeLabel = ({ closeModal = true } = {}) => {
        const start = opnameDateStart?.value || "";
        const end = opnameDateEnd?.value || "";
        const presetLabel = activeOpnamePreset === "today" ? "Hari ini"
            : activeOpnamePreset === "yesterday" ? "Kemarin"
                : activeOpnamePreset === "this_month" ? "Bulan ini"
                    : activeOpnamePreset === "30d" ? "30 hari sebelumnya"
                        : activeOpnamePreset === "last_month" ? "Bulan kemarin"
                            : activeOpnamePreset === "last_year" ? "Tahun kemarin"
                                : activeOpnamePreset === "this_year" ? "Tahun ini"
                                    : "7 hari sebelumnya";
        if (opnameRangeLabel) {
            opnameRangeLabel.textContent = presetLabel;
        }
        if (opnameRangeValues) {
            opnameRangeValues.textContent = start && end ? `${displayDate(start)} - ${displayDate(end)}` : "Pilih tanggal";
        }
        applyOpnameFilters();
        if (closeModal) {
            opnameDateModalInstance?.hide();
        }
    };

    const applyOpnameFilters = () => {
        if (!opnamePanel) return;
        const query = String(opnameSearch?.value || "").trim().toLowerCase();
        const status = opnameStatusToggle?.dataset.statusValue || "";
        const start = startOfDay(opnameDateStart?.value || "");
        const end = endOfDay(opnameDateEnd?.value || "");
        let visible = 0;

        opnameRows.forEach((row) => {
            const matchesQuery = !query || String(row.textContent || "").toLowerCase().includes(query);
            const matchesStatus = !status || row.dataset.status === status;
            const rowStartParsed = parseInventoryDateTime(row.dataset.start || "");
            const rowEndParsed = parseInventoryDateTime(row.dataset.end || "");
            const rowStart = rowStartParsed ? new Date(rowStartParsed.getFullYear(), rowStartParsed.getMonth(), rowStartParsed.getDate(), 0, 0, 0, 0) : null;
            const rowEndSource = rowEndParsed || rowStartParsed;
            const rowEnd = rowEndSource ? new Date(rowEndSource.getFullYear(), rowEndSource.getMonth(), rowEndSource.getDate(), 23, 59, 59, 999) : null;
            const matchesDate = (!start || (rowEnd && rowEnd >= start)) && (!end || (rowStart && rowStart <= end));
            const show = matchesQuery && matchesStatus && matchesDate;
            row.hidden = !show;
            if (show) visible += 1;
        });

        if (opnameTotal) {
            opnameTotal.textContent = `Total ${visible}`;
        }
    };

    const syncOpnameDetailRow = (row) => {
        if (!row) return;
        const expected = Number.parseInt(row.dataset.opnameExpected || "0", 10) || 0;
        const input = row.querySelector(".js-inventory-opname-counted");
        const diffWrap = row.querySelector(".js-inventory-opname-difference");
        const diffValue = row.querySelector(".js-inventory-opname-diff-value");
        const icon = row.querySelector(".inventory-opname-detail__difference-icon i");
        const counted = Math.max(0, Number.parseInt(String(input?.value || "").replace(/[^\d]/g, ""), 10) || 0);
        const diff = counted - expected;

        if (input) {
            input.value = String(counted);
        }

        row.classList.remove("is-complete", "is-short", "is-over");
        diffWrap?.classList.remove("is-complete", "is-short", "is-over");

        if (diff === 0) {
            row.classList.add("is-complete");
            diffWrap?.classList.add("is-complete");
            if (diffValue) diffValue.textContent = "0";
            if (icon) icon.className = "bi bi-check-lg";
        } else if (diff < 0) {
            row.classList.add("is-short");
            diffWrap?.classList.add("is-short");
            if (diffValue) diffValue.textContent = String(diff);
            if (icon) icon.className = "bi bi-chevron-down";
        } else {
            row.classList.add("is-over");
            diffWrap?.classList.add("is-over");
            if (diffValue) diffValue.textContent = String(diff);
            if (icon) icon.className = "bi bi-chevron-up";
        }
    };

    const applyOpnameDetailFilters = () => {
        const query = String(opnameDetailSearch?.value || "").trim().toLowerCase();
        let visible = 0;
        opnameDetailRows.forEach((row) => {
            const haystack = [
                row.dataset.opnameName || "",
                row.dataset.opnameCode || "",
                row.dataset.opnameSku || "",
            ].join(" ").toLowerCase();
            const show = !query || haystack.includes(query);
            row.hidden = !show;
            if (show) visible += 1;
        });
        if (opnameDetailTotal) {
            opnameDetailTotal.textContent = `Total ${visible}`;
        }
    };

    const closeOpnameRowMenus = (exceptRow = null) => {
        opnameDetailRows.forEach((row) => {
            if (exceptRow && row === exceptRow) return;
            row.querySelector(".inventory-opname-detail__menu-popover")?.setAttribute("hidden", "hidden");
        });
    };

    const resetOpnameImportState = () => {
        if (opnameImportFile) {
            opnameImportFile.value = "";
        }
        if (opnameImportFileLabel) {
            opnameImportFileLabel.textContent = "Pilih File";
        }
        if (opnameImportMeta) {
            opnameImportMeta.textContent = "Belum ada file dipilih";
        }
        if (opnameImportRun) {
            opnameImportRun.disabled = true;
            opnameImportRun.textContent = "Import";
        }
    };

    const getInventoryNowLabel = () => new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date()).replace(/\./g, ":");

    const getNextOpnameDraftName = () => {
        const maxNumber = opnameRows.reduce((highest, row) => {
            const match = String(row.dataset.name || "").match(/#(\d+)/);
            const value = match ? Number.parseInt(match[1], 10) || 0 : 0;
            return Math.max(highest, value);
        }, 0);

        return `Stock Opname #${maxNumber + 1}`;
    };

    const getOpnameStatusTone = (status) => {
        const normalized = String(status || "").toLowerCase();
        if (normalized.includes("review") || normalized.includes("meninjau")) {
            return "accent";
        }
        if (normalized.includes("perhitungan") || normalized.includes("pending")) {
            return "attention";
        }
        if (normalized.includes("komplit") || normalized.includes("complete") || normalized.includes("aman")) {
            return "safe";
        }
        if (normalized.includes("baru") || normalized.includes("proses") || normalized.includes("dikirim")) {
            return "accent";
        }
        if (normalized.includes("batal") || normalized.includes("arsip") || normalized.includes("nonaktif")) {
            return "muted";
        }
        return "attention";
    };

    const normalizeOpnameUiStatus = (status) => {
        const normalized = String(status || "").trim().toLowerCase();
        if (normalized.includes("complete") || normalized.includes("komplit")) {
            return "Completed";
        }
        if (normalized.includes("cancel") || normalized.includes("dibatal")) {
            return "Cancelled";
        }
        if (normalized.includes("count") || normalized.includes("perhitungan") || normalized.includes("pending")) {
            return "Perhitungan";
        }

        return "Meninjau";
    };

    const getOpnameDetailSnapshot = () => {
        return opnameDetailRows.map((row) => {
            const countedInput = row.querySelector(".js-inventory-opname-counted");
            const counted = Math.max(0, Number.parseInt(String(countedInput?.value || "").replace(/[^\d]/g, ""), 10) || 0);
            const expected = Number.parseInt(row.dataset.opnameExpected || "0", 10) || 0;
            return {
                product_id: Number(row.dataset.productId || 0),
                name: row.dataset.opnameName || "",
                code: row.dataset.opnameCode || "-",
                sku: row.dataset.opnameSku || "-",
                expected,
                counted,
                diff: counted - expected,
                cost: (counted - expected) * 25000,
            };
        });
    };

    const fillOpnameDetailRows = (items = []) => {
        const itemMap = new Map();
        items.forEach((item) => {
            const productId = Number(item.product_id || 0);
            const sku = String(item.sku || "");
            const name = String(item.name || "");
            if (productId > 0) {
                itemMap.set(`id:${productId}`, item);
            }
            if (sku) {
                itemMap.set(`sku:${sku}`, item);
            }
            if (name) {
                itemMap.set(`name:${name}`, item);
            }
        });

        opnameDetailRows.forEach((row) => {
            const match = itemMap.get(`id:${Number(row.dataset.productId || 0)}`)
                || itemMap.get(`sku:${String(row.dataset.opnameSku || "")}`)
                || itemMap.get(`name:${String(row.dataset.opnameName || "")}`);
            const input = row.querySelector(".js-inventory-opname-counted");
            if (input instanceof HTMLInputElement) {
                if (match) {
                    input.value = String(Math.max(0, Number.parseInt(String(match.counted ?? 0), 10) || 0));
                } else {
                    input.value = "";
                }
            }
            syncOpnameDetailRow(row);
        });
        applyOpnameDetailFilters();
    };

    const openOpnameDetailModal = (row = null) => {
        activeOpnameReviewRow = row;
        const fallbackName = row?.dataset.name || getNextOpnameDraftName();
        const fallbackNote = row?.dataset.note || "Tidak ada catatan";
        const fallbackStart = row?.dataset.start || getInventoryNowLabel();
        const fallbackLocation = row?.dataset.location || "Star Salon";
        const fallbackStaff = row?.dataset.startedBy || "Rayhan Doni Pramana";
        if (opnameSummaryName) {
            opnameSummaryName.textContent = fallbackName;
        }
        if (opnameSummaryNote) {
            opnameSummaryNote.textContent = fallbackNote;
        }
        if (opnameSummaryStart) {
            opnameSummaryStart.textContent = fallbackStart;
        }
        if (opnameSummaryLocation) {
            opnameSummaryLocation.textContent = fallbackLocation;
        }
        if (opnameSummaryStaff) {
            opnameSummaryStaff.textContent = fallbackStaff;
        }
        if (opnameDetailSearch) {
            opnameDetailSearch.value = "";
        }
        fillOpnameDetailRows(parseJsonData(row?.dataset.reviewItems));
        suppressOpnameDetailAutosave = false;
        opnameDetailModal?.show();
    };

    const returnToOpnameTable = (row) => {
        applyOpnameFilters();
        applyTab("opname");
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };

    const persistOpnameDetail = async (status = "Perhitungan") => {
        const locationButton = orderLocationOptions.find((button) => (button.dataset.locationName || "") === "Star Salon") || orderLocationOptions[0];
        const response = await inventoryPost("/api/inventory/opnames/save", {
            id: activeOpnameReviewRow?.dataset.opnameId || 0,
            name: opnameSummaryName?.textContent?.trim() || "Stock Opname",
            note: opnameSummaryNote?.textContent?.trim() === "Tidak ada catatan" ? "" : (opnameSummaryNote?.textContent?.trim() || ""),
            status,
            location_id: locationButton?.dataset.locationId || 1,
            items_json: JSON.stringify(getOpnameDetailSnapshot()),
        });
        const payload = response.row || {};

        return upsertOpnameMainRow({
            id: payload.id,
            name: payload.name || opnameSummaryName?.textContent?.trim() || "Stock Opname",
            note: payload.note || "",
            location: payload.location || opnameSummaryLocation?.textContent?.trim() || "Star Salon",
            start: payload.started_at || opnameSummaryStart?.textContent?.trim() || "01 Mei 2026, 13:16",
            end: payload.ended_at || "-",
            status: payload.status || status,
            items: payload.items || getOpnameDetailSnapshot(),
            cancelNote: payload.cancelled_note || "",
            cancelledBy: payload.cancelled_by || "",
            startedBy: payload.started_by || opnameSummaryStaff?.textContent?.trim() || "Rayhan Doni Pramana",
            sourceRow: activeOpnameReviewRow,
        });
    };

    const upsertOpnameMainRow = (payload) => {
        if (!opnameBody) return null;
        const safeName = String(payload.name || "Stock Opname #5");
        const safeLocation = String(payload.location || "Star Salon");
        const safeStatus = normalizeOpnameUiStatus(payload.status || "Meninjau");
        const safeStart = String(payload.start || "01 Mei 2026, 13:16");
        const safeEnd = String(payload.end || "-");
        const safeNote = String(payload.note || "");
        const safeCancelNote = String(payload.cancelNote || "");
        const safeCancelledBy = String(payload.cancelledBy || "");
        const safeStartedBy = String(payload.startedBy || "Rayhan Doni Pramana");
        const tone = getOpnameStatusTone(safeStatus);
        const payloadId = Number(payload.id || 0);
        let row = payload.sourceRow instanceof HTMLElement ? payload.sourceRow : null;
        if (!row) {
            row = payloadId > 0
                ? opnameRows.find((item) => Number(item.dataset.opnameId || 0) === payloadId)
                : opnameRows.find((item) => item.dataset.name === safeName);
        }
        if (!row) {
            row = document.createElement("tr");
            row.setAttribute("data-inventory-opname-row", "");
            opnameBody.prepend(row);
            opnameRows.unshift(row);
        }
        row.dataset.opnameId = String(payloadId || row.dataset.opnameId || 0);
        row.dataset.name = safeName;
        row.dataset.location = safeLocation;
        row.dataset.status = safeStatus;
        row.dataset.start = safeStart;
        row.dataset.end = safeEnd;
        row.dataset.note = safeNote;
        row.dataset.cancelNote = safeCancelNote;
        row.dataset.cancelledBy = safeCancelledBy;
        row.dataset.startedBy = safeStartedBy;
        row.dataset.reviewItems = JSON.stringify(payload.items || []);
        row.innerHTML = `
            <td class="inventory-name-cell">
                <span class="inventory-row-icon"><i class="bi bi-clipboard2-check"></i></span>
                <strong>${safeName}</strong>
            </td>
            <td>${safeLocation}</td>
            <td>${safeStart}</td>
            <td>${safeEnd}</td>
            <td><span class="inventory-status inventory-status--${tone}">${safeStatus}</span></td>
        `;
        return row;
    };

    const renderOpnameReviewTable = () => {
        if (!activeOpnameReviewRow || !opnameReviewBody) return;
        let items = [];
        try {
            items = JSON.parse(activeOpnameReviewRow.dataset.reviewItems || "[]");
        } catch {
            items = [];
        }
        if (!Array.isArray(items) || !items.length) {
            items = getOpnameDetailSnapshot();
        }
        const query = String(opnameReviewSearch?.value || "").trim().toLowerCase();
        const countedItems = items;
        const mismatchItems = items.filter((item) => Number(item.diff || 0) !== 0);
        const exceptionItems = items.filter((item) => Number(item.counted || 0) === 0);
        opnameReviewFilters.forEach((button) => {
            const kind = button.dataset.filter || "";
            if (kind === "counted") button.textContent = `Terhitung (${countedItems.length})`;
            if (kind === "exception") button.textContent = `Pengecualian (${exceptionItems.length})`;
            if (kind === "mismatch") button.textContent = `Tidak Cocok (${mismatchItems.length})`;
            button.classList.toggle("is-active", kind === activeOpnameReviewFilter);
        });
        const visibleItems = items.filter((item) => {
            const haystack = `${item.name} ${item.sku}`.toLowerCase();
            const matchQuery = !query || haystack.includes(query);
            if (!matchQuery) return false;
            if (activeOpnameReviewFilter === "counted") return true;
            if (activeOpnameReviewFilter === "exception") return Number(item.counted || 0) === 0;
            if (activeOpnameReviewFilter === "mismatch") return Number(item.diff || 0) !== 0;
            return true;
        });
        opnameReviewBody.innerHTML = visibleItems.map((item) => {
            const diff = Number(item.diff || 0);
            const iconClass = diff === 0 ? "bi-check-lg" : diff < 0 ? "bi-chevron-down" : "bi-chevron-up";
            const stateClass = diff === 0 ? "is-complete" : diff < 0 ? "is-short" : "is-over";
            const diffText = diff === 0 ? "0.00" : diff.toFixed(2);
            const costText = new Intl.NumberFormat("id-ID").format(Math.abs(Number(item.cost || 0)));
            return `
                <tr>
                    <td>
                        <div class="inventory-opname-detail__product">
                            <span class="inventory-opname-detail__product-icon"><i class="bi bi-bottle-perfume"></i></span>
                            <strong>${item.name}</strong>
                        </div>
                    </td>
                    <td>${item.sku || "-"}</td>
                    <td>${Number(item.expected || 0).toFixed(2)}</td>
                    <td>${Number(item.counted || 0).toFixed(2)}</td>
                    <td>
                        <div class="inventory-opname-detail__difference ${stateClass}">
                            <span class="inventory-opname-detail__difference-icon"><i class="bi ${iconClass}"></i></span>
                            <strong>${diffText}</strong>
                        </div>
                    </td>
                    <td>${diff < 0 ? "-" : ""}${costText},00</td>
                </tr>
            `;
        }).join("") || `<tr><td colspan="6" class="inventory-opname-review__empty">Tidak ada data</td></tr>`;
        if (opnameReviewTotal) {
            opnameReviewTotal.textContent = `Total ${visibleItems.length}`;
        }
    };

    const setOpnameMainRowStatus = (row, status, {
        end = row?.dataset.end || "-",
        note = row?.dataset.note || "",
        cancelNote = row?.dataset.cancelNote || "",
        cancelledBy = row?.dataset.cancelledBy || "",
    } = {}) => {
        if (!row) return;
        row.dataset.status = status;
        row.dataset.end = end;
        row.dataset.note = note;
        row.dataset.cancelNote = cancelNote;
        row.dataset.cancelledBy = cancelledBy;
        const tone = getOpnameStatusTone(status);
        const badge = row.querySelector(".inventory-status");
        if (badge) {
            badge.className = `inventory-status inventory-status--${tone}`;
            badge.textContent = status;
        }
        const endCell = row.children[3];
        if (endCell) {
            endCell.textContent = end;
        }
    };

    const setOpnameReviewMode = (mode, row) => {
        activeOpnameReviewMode = mode;
        if (opnameReviewModalEl) {
            opnameReviewModalEl.dataset.reviewMode = mode;
        }
        const isReviewing = mode === "reviewing";
        const isCancelled = mode === "cancelled";
        const isCompleted = mode === "completed";
        const isCounting = mode === "counting";

        if (opnameReviewTitle) {
            opnameReviewTitle.textContent = isReviewing ? "Tinjau Stok Barang" : "Detail Stok Barang";
        }
        if (opnameReviewStatus) {
            opnameReviewStatus.textContent = isReviewing
                ? "Meninjau"
                : isCancelled
                    ? "Cancelled"
                    : isCompleted
                        ? "Completed"
                        : "Perhitungan";
            opnameReviewStatus.className = `inventory-opname-review__status ${isReviewing ? "is-reviewing" : isCancelled ? "is-cancelled" : isCompleted ? "is-complete" : "is-counting"}`;
        }
        if (opnameReviewSummary) {
            opnameReviewSummary.classList.toggle("is-reviewing", isReviewing);
            opnameReviewSummary.classList.toggle("is-cancelled", isCancelled);
            opnameReviewSummary.classList.toggle("is-complete", isCompleted);
            opnameReviewSummary.classList.toggle("is-counting", isCounting);
        }
        if (opnameReviewCancelled) {
            opnameReviewCancelled.hidden = !isCancelled;
        }
        if (opnameReviewCancelledBy && row) {
            opnameReviewCancelledBy.textContent = row.dataset.cancelledBy || "Rayhan Doni Pramana";
        }
        if (opnameReviewEndWrap) {
            opnameReviewEndWrap.hidden = !(isCompleted || isCancelled);
        }
        if (opnameReviewEnd) {
            opnameReviewEnd.textContent = row?.dataset.end && row.dataset.end !== "-" ? row.dataset.end : "-";
        }
        if (opnameReviewReviewedWrap) {
            opnameReviewReviewedWrap.hidden = !isCompleted;
        }
        if (opnameReviewReviewedBy) {
            opnameReviewReviewedBy.textContent = row?.dataset.cancelledBy || row?.dataset.startedBy || "Rayhan Doni Pramana";
        }
        if (opnameReviewMore?.parentElement) {
            opnameReviewMore.parentElement.hidden = !isReviewing;
        }
        if (opnameReviewComplete) {
            opnameReviewComplete.hidden = !isReviewing;
        }
        if (opnameReviewExport) {
            opnameReviewExport.hidden = !(isCancelled || isCompleted);
        }
        opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
    };

    const openOpnameReviewModal = (row) => {
        if (!row) return;
        activeOpnameReviewRow = row;
        const normalizedStatus = String(row.dataset.status || "").toLowerCase();
        const mode = normalizedStatus.includes("meninjau")
            ? "reviewing"
            : normalizedStatus.includes("komplit") || normalizedStatus.includes("complete")
                ? "completed"
                : normalizedStatus.includes("dibatal") || normalizedStatus.includes("cancel")
                    ? "cancelled"
                    : "counting";
        if (opnameReviewName) opnameReviewName.textContent = row.dataset.name || "Stock Opname";
        if (opnameReviewNote) opnameReviewNote.textContent = row.dataset.note || "Tidak ada catatan";
        if (opnameReviewStart) opnameReviewStart.textContent = row.dataset.start || "-";
        if (opnameReviewLocation) opnameReviewLocation.textContent = row.dataset.location || "Star Salon";
        if (opnameReviewStaff) opnameReviewStaff.textContent = row.dataset.startedBy || "Rayhan Doni Pramana";
        setOpnameReviewMode(mode, row);
        activeOpnameReviewFilter = "counted";
        if (opnameReviewSearch) opnameReviewSearch.value = "";
        renderOpnameReviewTable();
        opnameReviewModal?.show();
    };

    const applySimpleInventorySearch = (rows, query, totalNode) => {
        let visible = 0;
        rows.forEach((row) => {
            const show = !query || String(row.textContent || "").toLowerCase().includes(query);
            row.hidden = !show;
            if (show) visible += 1;
        });
        if (totalNode) {
            totalNode.textContent = `Total ${visible}`;
        }
    };

    const applyBrandFilters = () => {
        applySimpleInventorySearch(brandRows, String(brandSearch?.value || "").trim().toLowerCase(), brandTotal);
    };

    const applyCategoryFilters = () => {
        applySimpleInventorySearch(categoryRows, String(categorySearch?.value || "").trim().toLowerCase(), categoryTotal);
    };

    const applySupplierFilters = () => {
        applySimpleInventorySearch(supplierRows, String(supplierSearch?.value || "").trim().toLowerCase(), supplierTotal);
    };

    const resetImportState = () => {
        if (importFile) importFile.value = "";
        if (importMeta) importMeta.textContent = "Belum ada file dipilih";
        if (importRun) {
            importRun.disabled = true;
            importRun.textContent = "Import (0)";
        }
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            applyTab(tab.dataset.inventoryTab || "products");
        });
    });

    productModalTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            applyProductModalTab(tab.dataset.inventoryProductTab || "details");
        });
    });

    masterTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            applyMasterTab(tab.dataset.inventoryMasterTab || "brands");
        });
    });

    masterItemSave?.addEventListener("click", saveMasterItem);
    masterItemDelete?.addEventListener("click", deleteMasterItem);
    masterItemModalEl?.addEventListener("hidden.bs.modal", resetMasterItemModal);
    supplierModalSave?.addEventListener("click", saveSupplierItem);
    supplierModalDelete?.addEventListener("click", deleteSupplierItem);
    supplierModalEl?.addEventListener("hidden.bs.modal", resetSupplierModal);

    productSearch?.addEventListener("input", applyProductFilters);
    purchaseSearch?.addEventListener("input", applyPurchaseFilters);
    opnameSearch?.addEventListener("input", applyOpnameFilters);
    opnameDetailSearch?.addEventListener("input", applyOpnameDetailFilters);
    opnameDetailSearch?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyOpnameDetailFilters();
        }
    });
    opnameEditOpen?.addEventListener("click", () => {
        opnameEditModal?.show();
    });
    opnameImportOpen?.addEventListener("click", () => {
        opnameImportModal?.show();
    });
    opnameEditNote?.addEventListener("input", () => {
        const length = String(opnameEditNote.value || "").length;
        if (opnameEditCounter) {
            opnameEditCounter.textContent = `${length}/200`;
        }
    });
    opnameEditSave?.addEventListener("click", () => {
        const nextName = String(opnameEditName?.value || "").trim() || "Stock Opname #5";
        const nextNote = String(opnameEditNote?.value || "").trim();
        if (opnameSummaryName) {
            opnameSummaryName.textContent = nextName;
        }
        if (opnameSummaryNote) {
            opnameSummaryNote.textContent = nextNote || "Tidak ada catatan";
        }
        opnameEditModal?.hide();
    });
    opnameImportTemplate?.addEventListener("click", () => {
        const blob = new Blob(["nama_produk,kode_barang,sku,terhitung\n"], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "template-stok-opname.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    });
    opnameImportFile?.addEventListener("change", () => {
        const count = opnameImportFile.files?.length || 0;
        const fileName = count ? opnameImportFile.files[0].name : "Pilih File";
        if (opnameImportFileLabel) {
            opnameImportFileLabel.textContent = fileName;
        }
        if (opnameImportMeta) {
            opnameImportMeta.textContent = count ? `${fileName} siap diimport` : "Belum ada file dipilih";
        }
        if (opnameImportRun) {
            opnameImportRun.disabled = count === 0;
            opnameImportRun.textContent = count ? `Import (${count})` : "Import";
        }
    });
    opnameImportRun?.addEventListener("click", () => {
        if (!opnameImportFile?.files?.length) return;
        opnameDetailRows.forEach((row) => {
            const input = row.querySelector(".js-inventory-opname-counted");
            if (input instanceof HTMLInputElement) {
                input.value = String(row.dataset.opnameExpected || "0");
            }
            syncOpnameDetailRow(row);
        });
        applyOpnameDetailFilters();
        opnameImportModal?.hide();
        if (quickTitle) quickTitle.textContent = "Import Stok Opname";
        if (quickCopy) quickCopy.textContent = `${opnameImportFile.files[0].name} berhasil dimuat ke stok opname.`;
        quickModal?.show();
        resetOpnameImportState();
    });
    opnameImportModalEl?.addEventListener("hidden.bs.modal", resetOpnameImportState);
    const submitOpnameForReview = async () => {
        try {
            const targetRow = await persistOpnameDetail("Meninjau");
            suppressOpnameDetailAutosave = true;
            opnameDetailModal?.hide();
            returnToOpnameTable(targetRow);
        } catch (error) {
            handleInventoryError(error, "Stok Opname");
        }
    };
    opnameReviewButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void submitOpnameForReview();
    });
    opnameDetailModalEl?.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement
            ? event.target.closest(".js-inventory-opname-review")
            : null;
        if (!target || target === opnameReviewButton) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        void submitOpnameForReview();
    });
    opnameDetailModalEl?.addEventListener("hide.bs.modal", async (event) => {
        if (suppressOpnameDetailAutosave || opnameDetailPersisting) {
            suppressOpnameDetailAutosave = false;
            return;
        }
        event.preventDefault();
        opnameDetailPersisting = true;
        try {
            const targetRow = await persistOpnameDetail("Perhitungan");
            returnToOpnameTable(targetRow);
            suppressOpnameDetailAutosave = true;
            opnameDetailModal?.hide();
        } catch (error) {
            handleInventoryError(error, "Simpan Perhitungan Stok");
        } finally {
            opnameDetailPersisting = false;
        }
    });
    opnameBody?.addEventListener("click", (event) => {
        const row = event.target instanceof HTMLElement ? event.target.closest("[data-inventory-opname-row]") : null;
        if (!row) return;
        const normalizedStatus = String(row.dataset.status || "").toLowerCase();
        if (normalizedStatus.includes("meninjau") || normalizedStatus.includes("komplit") || normalizedStatus.includes("complete") || normalizedStatus.includes("dibatal") || normalizedStatus.includes("cancel")) {
            openOpnameReviewModal(row);
            return;
        }
        openOpnameDetailModal(row);
    });
    opnameReviewSearch?.addEventListener("input", renderOpnameReviewTable);
    opnameReviewFilters.forEach((button) => {
        button.addEventListener("click", () => {
            activeOpnameReviewFilter = button.dataset.filter || "counted";
            renderOpnameReviewTable();
        });
    });
    opnameReviewMore?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (opnameReviewMoreMenu?.hasAttribute("hidden")) {
            opnameReviewMoreMenu.removeAttribute("hidden");
        } else {
            opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
        }
    });
    opnameReviewMoreMenu?.addEventListener("click", (event) => {
        event.stopPropagation();
    });
    document.addEventListener("click", () => {
        opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
    });
    opnameReviewRecount?.addEventListener("click", async () => {
        if (!activeOpnameReviewRow) return;
        try {
            const response = await inventoryPost("/api/inventory/opnames/recount", {
                id: activeOpnameReviewRow.dataset.opnameId || 0,
            });
            const payload = response.row || {};
            const targetRow = upsertOpnameMainRow({
                id: payload.id,
                name: payload.name,
                note: payload.note || "",
                location: payload.location || activeOpnameReviewRow.dataset.location || "Star Salon",
                start: payload.started_at || activeOpnameReviewRow.dataset.start || "-",
                end: payload.ended_at || "-",
                status: payload.status || "Perhitungan",
                items: payload.items || parseJsonData(activeOpnameReviewRow.dataset.reviewItems),
                cancelNote: "",
                cancelledBy: "",
                startedBy: payload.started_by || activeOpnameReviewRow.dataset.startedBy || "Rayhan Doni Pramana",
                sourceRow: activeOpnameReviewRow,
            });
            opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
            opnameReviewModal?.hide();
            applyOpnameFilters();
            targetRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (error) {
            handleInventoryError(error, "Stok Opname");
        }
    });
    opnameReviewCancelOpen?.addEventListener("click", () => {
        opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
        if (opnameCancelNote) {
            opnameCancelNote.value = "";
        }
        if (opnameCancelCounter) {
            opnameCancelCounter.textContent = "0/200";
        }
        opnameCancelModal?.show();
    });
    opnameReviewComplete?.addEventListener("click", () => {
        if (!activeOpnameReviewRow) return;
        opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
        opnameCompleteModal?.show();
    });
    opnameCompleteSubmit?.addEventListener("click", async () => {
        if (!activeOpnameReviewRow) return;
        try {
            const response = await inventoryPost("/api/inventory/opnames/complete", {
                id: activeOpnameReviewRow.dataset.opnameId || 0,
            });
            const payload = response.row || {};
            const targetRow = upsertOpnameMainRow({
                id: payload.id,
                name: payload.name,
                note: payload.note || "",
                location: payload.location || activeOpnameReviewRow.dataset.location || "Star Salon",
                start: payload.started_at || activeOpnameReviewRow.dataset.start || "-",
                end: payload.ended_at || getInventoryNowLabel(),
                status: payload.status || "Completed",
                items: payload.items || parseJsonData(activeOpnameReviewRow.dataset.reviewItems),
                cancelNote: "",
                cancelledBy: "",
                startedBy: payload.started_by || activeOpnameReviewRow.dataset.startedBy || "Rayhan Doni Pramana",
                sourceRow: activeOpnameReviewRow,
            });
            opnameCompleteModal?.hide();
            applyOpnameFilters();
            targetRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            openOpnameReviewModal(targetRow);
        } catch (error) {
            handleInventoryError(error, "Stok Opname");
        }
    });
    opnameReviewExport?.addEventListener("click", () => {
        if (!activeOpnameReviewRow) return;
        const items = parseJsonData(activeOpnameReviewRow.dataset.reviewItems);
        const rows = [["product_name", "sku", "expected", "counted", "difference", "cost"]];
        items.forEach((item) => {
            rows.push([
                item.name || "",
                item.sku || "-",
                String(item.expected ?? 0),
                String(item.counted ?? 0),
                String(item.diff ?? 0),
                String(item.cost ?? 0),
            ]);
        });
        const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${activeOpnameReviewRow.dataset.name || "stok-opname"}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    });
    opnameCancelNote?.addEventListener("input", () => {
        if (opnameCancelCounter) {
            opnameCancelCounter.textContent = `${String(opnameCancelNote.value || "").length}/200`;
        }
    });
    opnameCancelSubmit?.addEventListener("click", async () => {
        if (!activeOpnameReviewRow) return;
        try {
            const response = await inventoryPost("/api/inventory/opnames/cancel", {
                id: activeOpnameReviewRow.dataset.opnameId || 0,
                note: String(opnameCancelNote?.value || "").trim(),
            });
            const payload = response.row || {};
            const targetRow = upsertOpnameMainRow({
                id: payload.id,
                name: payload.name,
                note: payload.note || "",
                location: payload.location || activeOpnameReviewRow.dataset.location || "Star Salon",
                start: payload.started_at || activeOpnameReviewRow.dataset.start || "-",
                end: payload.ended_at || getInventoryNowLabel(),
                status: payload.status || "Cancelled",
                items: payload.items || parseJsonData(activeOpnameReviewRow.dataset.reviewItems),
                cancelNote: payload.cancelled_note || String(opnameCancelNote?.value || "").trim(),
                cancelledBy: payload.cancelled_by || "Staff",
                startedBy: payload.started_by || activeOpnameReviewRow.dataset.startedBy || "Rayhan Doni Pramana",
                sourceRow: activeOpnameReviewRow,
            });
            opnameCancelModal?.hide();
            opnameReviewModal?.hide();
            applyOpnameFilters();
            targetRow?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (error) {
            handleInventoryError(error, "Batalkan Stok Opname");
        }
    });
    brandSearch?.addEventListener("input", applyBrandFilters);
    categorySearch?.addEventListener("input", applyCategoryFilters);
    supplierSearch?.addEventListener("input", applySupplierFilters);
    [filterBrand, filterCategory, filterSupplier, filterStock].forEach((field) => {
        field?.addEventListener("change", applyProductFilters);
    });
    [purchaseFilterStatus, purchaseFilterSupplier].forEach((field) => {
        field?.addEventListener("change", applyPurchaseFilters);
    });

    productPanel?.querySelector(".js-inventory-filter-open")?.addEventListener("click", () => openDrawer(filterDrawer));
    filterDrawer?.querySelectorAll(".js-inventory-filter-close").forEach((button) => {
        button.addEventListener("click", () => closeDrawer(filterDrawer));
    });
    filterReset?.addEventListener("click", () => {
        if (filterBrand) filterBrand.value = "";
        if (filterCategory) filterCategory.value = "";
        if (filterSupplier) filterSupplier.value = "";
        if (filterStock) filterStock.value = "";
        applyProductFilters();
    });

    purchasePanel?.querySelector(".js-inventory-purchase-filter-open")?.addEventListener("click", () => openDrawer(purchaseFilterDrawer));
    purchaseFilterDrawer?.querySelectorAll(".js-inventory-purchase-filter-close").forEach((button) => {
        button.addEventListener("click", () => closeDrawer(purchaseFilterDrawer));
    });
    purchaseFilterReset?.addEventListener("click", () => {
        if (purchaseFilterStatus) purchaseFilterStatus.value = "";
        if (purchaseFilterSupplier) purchaseFilterSupplier.value = "";
        applyPurchaseFilters();
    });

    purchaseLocationOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const value = option.dataset.locationValue || "";
            const label = option.textContent?.trim() || "Pilih lokasi tujuan";
            if (purchaseLocationToggle) {
                purchaseLocationToggle.dataset.locationValue = value;
                const labelNode = purchaseLocationToggle.querySelector("span");
                if (labelNode) {
                    labelNode.textContent = label;
                }
            }
            purchaseLocationOptions.forEach((item) => {
                item.classList.toggle("is-active", item === option);
            });
            applyPurchaseFilters();
        });
    });

    opnameStatusOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const value = option.dataset.statusValue || "";
            const label = option.textContent?.trim() || "Status";
            if (opnameStatusToggle) {
                opnameStatusToggle.dataset.statusValue = value;
                const labelNode = opnameStatusToggle.querySelector("span");
                if (labelNode) {
                    labelNode.textContent = label;
                }
            }
            opnameStatusOptions.forEach((item) => {
                item.classList.toggle("is-active", item === option);
            });
            applyOpnameFilters();
        });
    });

    if (opnameDateRange && typeof flatpickr !== "undefined") {
        opnamePicker = flatpickr(opnameDateRange, {
            mode: "range",
            inline: true,
            dateFormat: "Y-m-d",
            defaultDate: [opnameDateStart?.value, opnameDateEnd?.value].filter(Boolean),
            onChange: (selectedDates) => {
                const [start, end] = selectedDates;
                if (opnameDateStart) opnameDateStart.value = start ? formatYmd(start) : "";
                if (opnameDateEnd) opnameDateEnd.value = end ? formatYmd(end) : "";
            },
        });
    }

    opnameDatePresets.forEach((button) => {
        button.addEventListener("click", () => {
            const preset = button.dataset.preset || "7d";
            const today = new Date();
            const start = new Date(today);
            const end = new Date(today);

            if (preset === "yesterday") {
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
            } else if (preset === "7d") {
                start.setDate(start.getDate() - 6);
            } else if (preset === "30d") {
                start.setDate(start.getDate() - 29);
            } else if (preset === "this_month") {
                start.setDate(1);
            } else if (preset === "last_month") {
                start.setMonth(start.getMonth() - 1, 1);
                end.setDate(0);
            } else if (preset === "this_year") {
                start.setMonth(0, 1);
            } else if (preset === "last_year") {
                start.setFullYear(start.getFullYear() - 1, 0, 1);
                end.setFullYear(end.getFullYear() - 1, 11, 31);
            }

            activeOpnamePreset = preset;
            if (opnameDateStart) opnameDateStart.value = formatYmd(start);
            if (opnameDateEnd) opnameDateEnd.value = formatYmd(end);
            opnamePicker?.setDate([start, end], true);
            opnameDatePresets.forEach((item) => {
                item.classList.toggle("is-active", item === button);
            });
        });
    });

    opnameDateReset?.addEventListener("click", () => {
        activeOpnamePreset = "7d";
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 6);
        if (opnameDateStart) opnameDateStart.value = formatYmd(start);
        if (opnameDateEnd) opnameDateEnd.value = formatYmd(today);
        opnamePicker?.setDate([start, today], true);
        opnameDatePresets.forEach((item) => {
            item.classList.toggle("is-active", item.dataset.preset === "7d");
        });
        applyOpnameRangeLabel({ closeModal: false });
    });

    opnameDateApply?.addEventListener("click", () => {
        applyOpnameRangeLabel();
    });

    opnameDetailRows.forEach((row) => {
        const input = row.querySelector(".js-inventory-opname-counted");
        const minusButton = row.querySelector(".js-inventory-opname-minus");
        const plusButton = row.querySelector(".js-inventory-opname-plus");
        const menuButton = row.querySelector(".js-inventory-opname-row-menu");
        const resetButton = row.querySelector(".js-inventory-opname-reset");
        const menuPopover = row.querySelector(".inventory-opname-detail__menu-popover");

        syncOpnameDetailRow(row);

        input?.addEventListener("input", () => {
            input.value = String(input.value || "").replace(/[^\d]/g, "");
            syncOpnameDetailRow(row);
        });

        input?.addEventListener("blur", () => {
            syncOpnameDetailRow(row);
        });

        minusButton?.addEventListener("click", () => {
            const current = Math.max(0, Number.parseInt(String(input?.value || "").replace(/[^\d]/g, ""), 10) || 0);
            if (input) {
                input.value = String(Math.max(0, current - 1));
            }
            syncOpnameDetailRow(row);
        });

        plusButton?.addEventListener("click", () => {
            const current = Math.max(0, Number.parseInt(String(input?.value || "").replace(/[^\d]/g, ""), 10) || 0);
            if (input) {
                input.value = String(current + 1);
            }
            syncOpnameDetailRow(row);
        });

        menuButton?.addEventListener("click", (event) => {
            event.stopPropagation();
            const isHidden = menuPopover?.hasAttribute("hidden") !== false;
            closeOpnameRowMenus(row);
            if (menuPopover) {
                if (isHidden) {
                    menuPopover.removeAttribute("hidden");
                } else {
                    menuPopover.setAttribute("hidden", "hidden");
                }
            }
        });

        resetButton?.addEventListener("click", () => {
            if (input) {
                input.value = "";
            }
            syncOpnameDetailRow(row);
            menuPopover?.setAttribute("hidden", "hidden");
        });
    });

    templateButton?.addEventListener("click", () => {
        const blob = new Blob(["nama_produk,kode_barang,harga,qty,merk,kategori,pemasok\n"], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "template-import-produk.csv";
        anchor.click();
        URL.revokeObjectURL(url);
    });

    importModalEl?.querySelector(".js-inventory-import-help")?.addEventListener("click", (event) => {
        event.preventDefault();
        if (importMeta) {
            importMeta.textContent = "Format file: nama_produk, kode_barang, harga, qty, merk, kategori, pemasok";
        }
    });

    importFile?.addEventListener("change", () => {
        const count = importFile.files?.length || 0;
        if (importMeta) {
            importMeta.textContent = count ? `${importFile.files[0].name}` : "Belum ada file dipilih";
        }
        if (importRun) {
            importRun.disabled = count === 0;
            importRun.textContent = `Import (${count})`;
        }
    });

    importRun?.addEventListener("click", () => {
        importModal?.hide();
        resetImportState();
    });

    importModalEl?.addEventListener("hidden.bs.modal", resetImportState);

    inventoryFab?.addEventListener("click", () => {
        if (activeInventoryTab === "products") {
            closeInventoryFabMenu();
            pendingProductDetail = null;
            productModal?.show();
            return;
        }

        if (activeInventoryTab === "purchases") {
            if (inventoryFabMenu?.hidden === false) {
                closeInventoryFabMenu();
            } else {
                openInventoryFabMenu();
            }
            return;
        }

        if (activeInventoryTab === "master") {
            closeInventoryFabMenu();
            if (activeMasterTab === "suppliers") {
                openSupplierModal();
                return;
            }
            openMasterItemModal(activeMasterTab);
            return;
        }

        if (activeInventoryTab === "opname") {
            closeInventoryFabMenu();
            openOpnameDetailModal(null);
        }
    });

    purchaseFabCloseButton?.addEventListener("click", closeInventoryFabMenu);
    purchaseActionButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const action = button.dataset.purchaseAction || "pesanan";
            closeInventoryFabMenu();
            if (action === "pesanan") {
                resetPurchaseOrderBuilder();
                purchaseOrderModal?.show();
                return;
            }
            if (quickTitle) quickTitle.textContent = "Transfer Stok";
            if (quickCopy) {
                quickCopy.textContent = "Aksi transfer stok sudah aktif dari tombol + di tab Pesanan.";
            }
            quickModal?.show();
        });
    });

    const bindOrderSupplierOption = (button) => {
        if (!button || button.dataset.boundClick === "true") return;
        button.dataset.boundClick = "true";
        button.addEventListener("click", () => {
            orderSupplierOptions.forEach((item) => item.classList.toggle("is-active", item === button));
            selectedSupplierState = {
                id: Number(button.dataset.supplierId || 0),
                name: button.dataset.supplierName || "",
                contact: button.dataset.supplierContact || "",
                address: button.dataset.supplierAddress || "",
            };
            renderPurchaseOrderSummary();
            setPurchaseOrderStep("location");
        });
    };

    const bindOrderLocationOption = (button) => {
        if (!button || button.dataset.boundClick === "true") return;
        button.dataset.boundClick = "true";
        button.addEventListener("click", () => {
            orderLocationOptions.forEach((item) => item.classList.toggle("is-active", item === button));
            selectedLocationState = {
                id: Number(button.dataset.locationId || 0),
                name: button.dataset.locationName || "",
                address: button.dataset.locationAddress || "",
            };
            renderPurchaseOrderSummary();
            setPurchaseOrderStep("order");
        });
    };

    orderSupplierOptions.forEach(bindOrderSupplierOption);
    orderLocationOptions.forEach(bindOrderLocationOption);

    orderNoteToggle?.addEventListener("click", () => {
        purchaseOrderNoteVisible = !purchaseOrderNoteVisible;
        if (orderNote) {
            orderNote.hidden = !purchaseOrderNoteVisible;
        }
        orderNoteToggle.classList.toggle("is-active", purchaseOrderNoteVisible);
    });

    orderProductSearch?.addEventListener("focus", () => {
        renderOrderSuggestions(orderProductSearch.value);
    });
    orderProductSearch?.addEventListener("input", () => {
        renderOrderSuggestions(orderProductSearch.value);
    });
    orderProductSearch?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addPurchaseOrderItem(visibleOrderSuggestions[0]?.name || orderProductSearch.value);
    });
    orderProductSuggestions?.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest(".js-order-product-suggestion") : null;
        if (!(target instanceof HTMLElement)) return;
        addPurchaseOrderItem(target.dataset.productName || "");
    });

    orderItemsBody?.addEventListener("input", (event) => {
        const target = event.target instanceof HTMLInputElement ? event.target : null;
        if (!target) return;
        const row = target.closest("[data-order-item-index]");
        if (!(row instanceof HTMLElement)) return;
        const index = Number(row.dataset.orderItemIndex || -1);
        const item = purchaseOrderItems[index];
        if (!item) return;

        if (target.classList.contains("js-order-item-qty")) {
            const digits = String(target.value || "").replace(/[^\d]/g, "");
            target.value = digits;
            item.qty = Number.parseInt(digits, 10) || 0;
        }
        if (target.classList.contains("js-order-item-price")) {
            const digits = String(target.value || "").replace(/[^\d]/g, "");
            target.value = digits;
            item.price = Number.parseInt(digits, 10) || 0;
        }
        syncPurchaseOrderRow(row, item);
    });

    orderItemsBody?.addEventListener("blur", (event) => {
        const target = event.target instanceof HTMLInputElement ? event.target : null;
        if (!target) return;
        const row = target.closest("[data-order-item-index]");
        if (!(row instanceof HTMLElement)) return;
        const index = Number(row.dataset.orderItemIndex || -1);
        const item = purchaseOrderItems[index];
        if (!item) return;

        if (target.classList.contains("js-order-item-qty")) {
            syncPurchaseOrderRow(row, item, { formatQty: true });
        }
        if (target.classList.contains("js-order-item-price")) {
            syncPurchaseOrderRow(row, item, { formatPrice: true });
        }
    }, true);

    orderItemsBody?.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest(".js-order-item-remove") : null;
        if (!target) return;
        const row = target.closest("[data-order-item-index]");
        if (!(row instanceof HTMLElement)) return;
        const index = Number(row.dataset.orderItemIndex || -1);
        purchaseOrderItems = purchaseOrderItems.filter((_, itemIndex) => itemIndex !== index);
        renderPurchaseOrderItems();
    });

    orderBackButton?.addEventListener("click", () => {
        if (purchaseOrderStep === "order") {
            setPurchaseOrderStep("location");
            return;
        }
        if (purchaseOrderStep === "location") {
            setPurchaseOrderStep("supplier");
        }
    });

    orderSubmitButton?.addEventListener("click", submitPurchaseOrder);
    purchaseOrderModalEl?.addEventListener("hidden.bs.modal", () => {
        resetPurchaseOrderBuilder();
        if (pendingPurchaseDetailRow) {
            const row = pendingPurchaseDetailRow;
            pendingPurchaseDetailRow = null;
            applyTab("purchases");
            row.scrollIntoView({ block: "nearest", behavior: "smooth" });
            row.classList.add("inventory-purchase-row--fresh");
            window.setTimeout(() => row.classList.remove("inventory-purchase-row--fresh"), 1800);
        }
    });

    purchasePanel?.querySelector("tbody")?.addEventListener("click", (event) => {
        const row = event.target instanceof Element ? event.target.closest("[data-inventory-purchase-row]") : null;
        if (!(row instanceof HTMLElement)) return;
        renderPurchaseDetail(row);
    });

    brandPanel?.querySelector("tbody")?.addEventListener("click", (event) => {
        const row = event.target instanceof Element ? event.target.closest("[data-inventory-brand-row]") : null;
        if (!(row instanceof HTMLElement)) return;
        openMasterItemModal("brands", row);
    });

    categoryPanel?.querySelector("tbody")?.addEventListener("click", (event) => {
        const row = event.target instanceof Element ? event.target.closest("[data-inventory-category-row]") : null;
        if (!(row instanceof HTMLElement)) return;
        openMasterItemModal("categories", row);
    });

    supplierPanel?.querySelector("tbody")?.addEventListener("click", (event) => {
        const row = event.target instanceof Element ? event.target.closest("[data-inventory-supplier-row]") : null;
        if (!(row instanceof HTMLElement)) return;
        openSupplierModal(row);
    });

    orderDetailItems?.addEventListener("input", (event) => {
        if (purchaseDetailMode !== "receive" || !activePurchaseDetailRow) return;
        const target = event.target instanceof HTMLInputElement ? event.target : null;
        if (!target?.classList.contains("js-order-detail-received-qty")) return;
        const row = target.closest("[data-order-receive-index]");
        if (!(row instanceof HTMLElement)) return;
        const index = Number(row.dataset.orderReceiveIndex || -1);
        const draft = ensurePurchaseReceiveDraft(activePurchaseDetailRow);
        const item = draft[index];
        if (!item) return;
        const digits = String(target.value || "").replace(/[^\d]/g, "");
        target.value = digits;
        item.receivedQty = Number.parseInt(digits, 10) || 0;
        const totalCell = row.children[4];
        if (totalCell) {
            totalCell.textContent = formatCurrencyValue((item.receivedQty || 0) * (item.price || 0));
        }
    });

    orderDetailItems?.addEventListener("blur", (event) => {
        if (purchaseDetailMode !== "receive" || !activePurchaseDetailRow) return;
        const target = event.target instanceof HTMLInputElement ? event.target : null;
        if (!target?.classList.contains("js-order-detail-received-qty")) return;
        const row = target.closest("[data-order-receive-index]");
        if (!(row instanceof HTMLElement)) return;
        const index = Number(row.dataset.orderReceiveIndex || -1);
        const draft = ensurePurchaseReceiveDraft(activePurchaseDetailRow);
        const item = draft[index];
        if (!item) return;
        target.value = String(item.receivedQty || 0);
    }, true);

    orderDetailEmail?.addEventListener("click", () => {
        const orderNumber = activePurchaseDetailRow?.dataset.order || "Order";
        if (quickTitle) quickTitle.textContent = `Email ${orderNumber}`;
        if (quickCopy) quickCopy.textContent = `Preview email untuk ${orderNumber} sudah siap dikirim ke pemasok.`;
        quickModal?.show();
    });

    orderDetailPdf?.addEventListener("click", () => {
        const orderNumber = activePurchaseDetailRow?.dataset.order || "Order";
        if (quickTitle) quickTitle.textContent = `Unduh PDF ${orderNumber}`;
        if (quickCopy) quickCopy.textContent = `File PDF untuk ${orderNumber} sudah disiapkan dari tampilan detail pesanan.`;
        quickModal?.show();
    });

    orderDetailCancel?.addEventListener("click", () => {
        if (!activePurchaseDetailRow) return;
        if (orderDetailConfirm) {
            orderDetailConfirm.hidden = false;
        }
    });

    orderDetailReceive?.addEventListener("click", () => {
        if (!activePurchaseDetailRow) return;
        activePurchaseDetailRow._purchaseReceiveDraft = null;
        renderPurchaseDetail(activePurchaseDetailRow, { mode: "receive" });
    });

    orderDetailReceiveBack?.addEventListener("click", () => {
        if (!activePurchaseDetailRow) return;
        activePurchaseDetailRow._purchaseReceiveDraft = null;
        renderPurchaseDetail(activePurchaseDetailRow, { mode: "view" });
    });

    orderDetailReceiveConfirm?.addEventListener("click", async () => {
        if (!activePurchaseDetailRow) return;
        try {
            const draft = ensurePurchaseReceiveDraft(activePurchaseDetailRow);
            const response = await inventoryPost("/api/inventory/purchases/receive", {
                id: activePurchaseDetailRow.dataset.purchaseId || 0,
                items_json: JSON.stringify(draft.map((item) => ({
                    name: item.name,
                    qty: item.qty || 0,
                    received_qty: item.receivedQty || 0,
                    price: item.price || 0,
                }))),
            });
            const row = upsertPurchaseRow(response.row || {});
            if (row) {
                activePurchaseDetailRow = row;
                activePurchaseDetailRow._purchaseReceiveDraft = null;
                applyPurchaseFilters();
                renderPurchaseDetail(activePurchaseDetailRow, { mode: "view" });
            }
        } catch (error) {
            handleInventoryError(error, "Penerimaan Pesanan");
        }
    });

    orderDetailConfirmClose.forEach((button) => {
        button.addEventListener("click", closePurchaseCancelConfirm);
    });

    orderDetailConfirmSubmit?.addEventListener("click", async () => {
        if (!activePurchaseDetailRow) return;
        try {
            const response = await inventoryPost("/api/inventory/purchases/cancel", {
                id: activePurchaseDetailRow.dataset.purchaseId || 0,
            });
            const row = upsertPurchaseRow(response.row || {});
            if (row) {
                activePurchaseDetailRow = row;
                activePurchaseDetailRow._purchaseReceiveDraft = null;
                applyPurchaseFilters();
                renderPurchaseDetail(activePurchaseDetailRow, { mode: "view" });
            }
        } catch (error) {
            handleInventoryError(error, "Batalkan Pesanan");
        }
    });
    orderDetailClose?.addEventListener("click", () => {
        purchaseDetailModal?.hide();
    });

    orderDetailLogsToggle?.addEventListener("click", () => {
        const isExpanded = orderDetailLogsToggle.getAttribute("aria-expanded") !== "false";
        const nextExpanded = !isExpanded;
        orderDetailLogsToggle.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
        orderDetailLogsPanel.hidden = !nextExpanded;
        const icon = orderDetailLogsToggle.querySelector("i");
        if (icon) {
            icon.className = nextExpanded ? "bi bi-chevron-up" : "bi bi-chevron-down";
        }
    });
    purchaseDetailModalEl?.addEventListener("hidden.bs.modal", () => {
        activePurchaseDetailRow = null;
        purchaseDetailMode = "view";
        closePurchaseCancelConfirm();
    });

    productModalEl?.addEventListener("show.bs.modal", () => {
        resetProductModal();
        if (pendingProductDetail) {
            populateProductModal(pendingProductDetail);
        }
    });
    productModalEl?.addEventListener("hidden.bs.modal", () => {
        resetProductModal();
        pendingProductDetail = null;
    });

    productNameInput?.addEventListener("input", updateProductSaveState);
    [productCategoryInput, productBrandInput, productDescriptionInput].forEach((field) => {
        field?.addEventListener("input", updateProductSaveState);
        field?.addEventListener("change", updateProductSaveState);
    });
    productSalesToggle?.addEventListener("change", updateProductSalesNote);
    productLocationSearch?.addEventListener("input", () => {
        const query = String(productLocationSearch.value || "").trim().toLowerCase();
        productLocationItems.forEach((item) => {
            const label = String(item.dataset.locationLabel || item.textContent || "").toLowerCase();
            item.hidden = Boolean(query) && !label.includes(query);
        });
    });
    productLocationItems.forEach((item) => {
        item.querySelector('input[type="checkbox"]')?.addEventListener("change", () => {
            syncHistorySummary(pendingProductDetail);
            updateProductSaveState();
        });
    });

    historyLocationToggle?.addEventListener("click", () => {
        const nextHidden = !(historyLocationMenu?.hidden === false);
        if (historyLocationMenu) {
            historyLocationMenu.hidden = !nextHidden ? true : false;
        }
        historyLocationToggle.setAttribute("aria-expanded", nextHidden ? "true" : "false");
    });

    historyLocationOptions.forEach((option) => {
        option.addEventListener("click", () => {
            historyLocationFilter = option.dataset.historyLocation || "all";
            historyPage = 1;
            historyLocationOptions.forEach((item) => {
                item.classList.toggle("is-active", item === option);
            });
            syncHistorySummary(pendingProductDetail);
            renderHistoryRows();
            closeHistoryLocationMenu();
        });
    });

    stockAdjustmentCloseButtons.forEach((button) => {
        button.addEventListener("click", closeStockAdjustmentModal);
    });
    stockAdjustmentReasons?.addEventListener("click", (event) => {
        const target = event.target.closest("[data-stock-adjustment-reason]");
        if (!target) return;
        stockAdjustmentReason = target.dataset.stockAdjustmentReason || "Other";
        renderStockAdjustmentReasons();
    });
    stockAdjustmentQtyDecrease?.addEventListener("click", () => {
        const nextValue = Math.max(1, normalizeStockAdjustmentQty({ writeBack: false }) - 1);
        if (stockAdjustmentQty) {
            stockAdjustmentQty.value = String(nextValue);
        }
    });
    stockAdjustmentQtyIncrease?.addEventListener("click", () => {
        const currentValue = normalizeStockAdjustmentQty({ writeBack: false });
        const maxValue = stockAdjustmentMode === "decrease"
            ? Math.max(1, Number(pendingProductDetail?.qty || 1))
            : Number.MAX_SAFE_INTEGER;
        if (stockAdjustmentQty) {
            stockAdjustmentQty.value = String(Math.min(maxValue, currentValue + 1));
        }
    });
    stockAdjustmentQty?.addEventListener("input", () => {
        const digits = String(stockAdjustmentQty.value || "").replace(/[^\d]/g, "");
        stockAdjustmentQty.value = digits;
    });
    stockAdjustmentQty?.addEventListener("blur", () => {
        normalizeStockAdjustmentQty();
    });
    stockAdjustmentPrice?.addEventListener("input", () => {
        const digits = String(stockAdjustmentPrice.value || "").replace(/[^\d]/g, "");
        stockAdjustmentPrice.value = digits ? `Rp ${digits}` : "";
    });
    stockAdjustmentPrice?.addEventListener("blur", () => {
        stockAdjustmentPrice.value = formatCurrencyValue(parseCurrencyValue(stockAdjustmentPrice.value || 0));
    });
    stockAdjustmentSave?.addEventListener("click", async () => {
        if (!activeProductRow) return;
        const qtyValue = normalizeStockAdjustmentQty();
        const costValue = parseCurrencyValue(stockAdjustmentPrice?.value || 0);
        const noteValue = String(stockAdjustmentNote?.value || "").trim();
        try {
            const response = await inventoryPost("/api/inventory/products/adjust-stock", {
                product_id: activeProductRow.dataset.productId || 0,
                mode: stockAdjustmentMode,
                quantity: qtyValue,
                supply_price: costValue,
                reason: stockAdjustmentReason,
                note: stockAdjustmentReason === "Other" ? noteValue : "",
            });
            const product = response.product || {};
            const movement = response.movement || {};
            if (pendingProductDetail) {
                pendingProductDetail.qty = Number(product.qty ?? movement.current_qty ?? pendingProductDetail.qty ?? 0);
                if (product.price) {
                    pendingProductDetail.price = product.price;
                }
            }
            activeProductRow.dataset.qty = String(product.qty ?? movement.current_qty ?? (activeProductRow.dataset.qty || 0));
            activeProductRow.dataset.status = product.status || activeProductRow.dataset.status || "";
            activeProductRow.dataset.stockState = Number(activeProductRow.dataset.qty || 0) > 0 ? "available" : "empty";
            const qtyCell = activeProductRow.children[3];
            if (qtyCell) {
                qtyCell.textContent = String(product.qty ?? movement.current_qty ?? 0);
            }

            historyRowsState.unshift({
                date: movement.created_at ? movement.created_at.split(",")[0] : new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
                time: movement.created_at ? movement.created_at.split(",")[1]?.trim() || "" : new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                staffPrimary: movement.staff || "Staff",
                staffSecondary: "",
                location: movement.location || "Star Salon",
                action: movement.note ? `${movement.reason}: ${movement.note}` : (movement.reason || stockAdjustmentReason),
                delta: Number(movement.actual_delta ?? 0),
                cost: Number(movement.cost ?? 0),
                realQty: Number(movement.current_qty ?? product.qty ?? 0),
            });
            activeProductRow._inventoryHistory = historyRowsState;
            syncHistorySummary(pendingProductDetail);
            renderHistoryRows();
            applyProductFilters();
            closeStockAdjustmentModal();
        } catch (error) {
            handleInventoryError(error, "Penyesuaian Stok");
        }
    });

    historyStockIncrease?.addEventListener("click", () => openStockAdjustmentModal("increase"));
    historyStockDecrease?.addEventListener("click", () => openStockAdjustmentModal("decrease"));
    historyRangeButton?.addEventListener("click", () => {
        historyRangeIndex = (historyRangeIndex + 1) % historyRangePresets.length;
        updateHistoryRangeCopy();
    });
    historyExportButton?.addEventListener("click", () => {
        const rows = historyRowsState.filter((row) => historyLocationFilter === "all" || row.location === historyLocationFilter);
        const csv = [
            "tanggal,waktu,staff_1,staff_2,lokasi,aksi,qty_diatur,biaya,qty_nyata",
            ...rows.map((row) => [row.date, row.time, row.staffPrimary, row.staffSecondary, row.location, row.action, row.delta, row.cost, row.realQty].join(",")),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `riwayat-stock-${String(pendingProductDetail?.code || "produk").toLowerCase()}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    });
    historyPageSizeButton?.addEventListener("click", () => {
        historyPageSize = historyPageSize === 10 ? 20 : historyPageSize === 20 ? 50 : 10;
        historyPage = 1;
        renderHistoryRows();
    });
    historyPrevButton?.addEventListener("click", () => {
        historyPage = Math.max(1, historyPage - 1);
        renderHistoryRows();
    });
    historyNextButton?.addEventListener("click", () => {
        historyPage += 1;
        renderHistoryRows();
    });
    historyGotoButton?.addEventListener("click", () => {
        historyPage = historyPage === 1 ? 2 : 1;
        renderHistoryRows();
    });
    productSaveButton?.addEventListener("click", saveProductChanges);
    document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest(".inventory-product-history-card__location-dropdown")) return;
        if (!target.closest(".js-inventory-fab") && !target.closest(".js-inventory-fab-menu")) {
            closeInventoryFabMenu();
        }
        if (!target.closest(".inventory-opname-detail__menu-wrap")) {
            closeOpnameRowMenus();
        }
        if (!target.closest(".inventory-opname-review__more-wrap")) {
            opnameReviewMoreMenu?.setAttribute("hidden", "hidden");
        }
        if (!target.closest(".inventory-order-searchfield")) {
            hideOrderSuggestions();
        }
        closeHistoryLocationMenu();
    });

    variantAddButton?.addEventListener("click", () => {
        appendVariantCard({ focus: true });
    });

    productPanel?.addEventListener("click", (event) => {
        const trigger = event.target instanceof HTMLElement ? event.target.closest(".js-inventory-product-open") : null;
        if (!trigger) return;
        const row = trigger.closest("[data-inventory-row]");
        if (!(row instanceof HTMLElement)) return;
        activeProductRow = row;
        pendingProductDetail = {
            name: row.dataset.name || "",
            code: row.dataset.code || "",
            brand: row.dataset.brand || "",
            category: row.dataset.category || "",
            supplier: row.dataset.supplier || "",
            type: row.dataset.type || "",
            typeLabel: row.dataset.typeLabel || "",
            unitAll: row.dataset.unitAll || "",
            usedIn: String(row.dataset.usedIn || "").split("|").filter(Boolean),
            usedInCount: Number(row.dataset.usedInCount || 0),
            price: row.dataset.price || "Rp 0,00",
            qty: Number(row.dataset.qty || 0),
            status: row.dataset.status || "Aktif",
        };
        productModal?.show();
        void loadProductHistory(row, pendingProductDetail);
    });

    variantList?.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        const card = target.closest(".js-inventory-variant-card");
        if (!card) return;

        if (target.closest(".js-inventory-variant-delete")) {
            const confirmBox = card.querySelector(".js-inventory-variant-confirm");
            const isHidden = confirmBox?.hidden !== false;
            closeVariantConfirms(card);
            if (confirmBox) {
                confirmBox.hidden = !isHidden;
            }
            return;
        }

        if (target.closest(".js-inventory-variant-cancel")) {
            const confirmBox = card.querySelector(".js-inventory-variant-confirm");
            if (confirmBox) confirmBox.hidden = true;
            return;
        }

        if (target.closest(".js-inventory-variant-confirm-delete")) {
            card.remove();
            return;
        }

    });

    variantList?.addEventListener("input", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.classList.contains("js-inventory-variant-name")) return;
        updateVariantNameState(target.closest(".js-inventory-variant-card"));
    });

    exportButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const format = (button.dataset.export || "").toUpperCase() || "DATA";
            if (quickTitle) quickTitle.textContent = "Export Produk";
            if (quickCopy) quickCopy.textContent = `Export ${format} untuk tab Produk sudah aktif. Nanti kita sambungkan ke file hasil export yang sebenarnya.`;
            quickModal?.show();
        });
    });

    purchaseExportButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const format = (button.dataset.export || "").toUpperCase() || "DATA";
            if (quickTitle) quickTitle.textContent = "Export Pesanan";
            if (quickCopy) quickCopy.textContent = `Export ${format} untuk tab Pesanan sudah aktif. Nanti kita sambungkan ke file hasil export yang sebenarnya.`;
            quickModal?.show();
        });
    });

    refreshInventoryLookupOptions();
    applyTab("products");
    applyProductModalTab("details");
    applyMasterTab("brands");
    applyPurchaseFilters();
    applyOpnameFilters();
    applyOpnameDetailFilters();
    applyOpnameRangeLabel({ closeModal: false });
    resetOpnameImportState();
    applyBrandFilters();
    applyCategoryFilters();
    applySupplierFilters();
    updateProductSalesNote();
    updateProductSaveState();
}

function initStaffNewModal(shell) {
    const modalEl = document.getElementById("staffModal");
    if (!modalEl) {
        return;
    }

    const modal = typeof bootstrap !== "undefined" ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
    const tabButtons = Array.from(modalEl.querySelectorAll("[data-staff-new-tab]"));
    const panels = Array.from(modalEl.querySelectorAll("[data-staff-new-panel]"));
    const nameInput = modalEl.querySelector(".js-staff-new-name");
    const phoneInput = modalEl.querySelector(".js-staff-new-phone");
    const emailInput = modalEl.querySelector(".js-staff-new-email");
    const titleInput = modalEl.querySelector(".js-staff-new-title");
    const saveBtn = modalEl.querySelector(".js-staff-new-save");
    const modalTitle = modalEl.querySelector(".js-staff-modal-title");
    const deleteBtn = modalEl.querySelector(".js-staff-edit-delete");
    const photoButton = modalEl.querySelector(".js-staff-photo-button");
    const photoInput = modalEl.querySelector(".js-staff-photo-input");
    const photoPreview = modalEl.querySelector(".js-staff-photo-preview");
    const bookingToggle = modalEl.querySelector(".js-staff-booking-toggle");
    const bookingSwitch = bookingToggle?.nextElementSibling;
    const startDate = modalEl.querySelector(".js-staff-start-date");
    const endDate = modalEl.querySelector(".js-staff-end-date");
    const serviceAll = modalEl.querySelector(".js-staff-service-all");
    const serviceChecks = Array.from(modalEl.querySelectorAll(".js-staff-service-check"));
    const locationAll = modalEl.querySelector(".js-staff-location-all");
    const locationSearch = modalEl.querySelector(".js-staff-location-search");
    const locationChecks = Array.from(modalEl.querySelectorAll(".js-staff-location-check"));
    const commissionEditor = modalEl.querySelector(".js-staff-commission-editor");
    const commissionEditorTitle = modalEl.querySelector(".js-staff-commission-editor-title");
    const commissionSummary = modalEl.querySelector(".js-staff-commission-summary");
    const commissionDefaultLabel = modalEl.querySelector(".js-staff-commission-default-label");
    const commissionUseDefaultLabel = modalEl.querySelector(".js-staff-commission-use-default-label");
    const commissionValue = modalEl.querySelector(".js-staff-commission-value");
    const commissionUseDefault = modalEl.querySelector(".js-staff-commission-use-default");
    const commissionSearch = modalEl.querySelector(".js-staff-commission-search");
    const commissionAssigned = modalEl.querySelector(".js-staff-commission-assigned");
    const commissionConfirm = modalEl.querySelector(".js-staff-commission-confirm");
    const commissionConfirmItem = modalEl.querySelector(".js-staff-commission-confirm-item");
    const commissionConfirmValue = modalEl.querySelector(".js-staff-commission-confirm-value");
    const commissionRows = Array.from(modalEl.querySelectorAll("[data-commission-service-row]"));
    const memberList = shell.querySelector(".staff-member-list");
    const commissionStaffMenu = shell.querySelector(".js-staff-commission-staff-filter")?.closest(".dropdown")?.querySelector(".ss-dropdown-menu");
    let activeCommissionTarget = "all";
    let activeCommissionLabelTarget = null;
    let photoDataUrl = "";
    let activeEditRow = null;
    const commissionTitles = {
        service: "Komisi per Layanan",
        product: "Komisi per Produk",
    };
    const commissionCopy = {
        service: {
            defaultLabel: "Komisi layanan default",
            checkboxLabel: "Semua layanan menggunakan komisi default yang sama",
            confirmItem: "Layanan",
        },
        product: {
            defaultLabel: "Komisi produk default",
            checkboxLabel: "Semua produk menggunakan komisi default yang sama",
            confirmItem: "Produk",
        },
    };

    const switchPanel = (panelName) => {
        tabButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.staffNewTab === panelName));
        panels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.staffNewPanel === panelName));
    };
    const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    })[char]);
    const normalizePhone = (value) => {
        const raw = String(value || "").trim();
        if (raw.startsWith("+")) return raw;
        const digits = raw.replace(/\D+/g, "").replace(/^0+/, "");
        return digits ? `+62${digits}` : "+62";
    };
    const setDateButtonText = (target, value) => {
        const button = modalEl.querySelector(`[data-date-target="${target}"] span`);
        if (button) {
            button.innerHTML = `<i class="bi bi-calendar3"></i> ${value || "Pilih hari"}`;
        }
    };
    const setActiveButton = (buttons, matcher, fallbackIndex = 0) => {
        let matched = false;
        buttons.forEach((button, index) => {
            const active = matcher(button, index);
            matched = matched || active;
            button.classList.toggle("is-active", active);
        });
        if (!matched && buttons[fallbackIndex]) {
            buttons[fallbackIndex].classList.add("is-active");
        }
    };
    const setRoleSelection = (role) => {
        const normalized = String(role || "").toLowerCase();
        const roleMap = normalized.includes("owner") || normalized.includes("manager")
            ? "Manager"
            : normalized.includes("senior")
                ? "Senior"
                : normalized.includes("junior")
                    ? "Junior"
                    : normalized.includes("supervisor")
                        ? "Supervisor"
                        : "Basic";
        setActiveButton(Array.from(modalEl.querySelectorAll("[data-staff-new-role]")), (button) => button.dataset.staffNewRole === roleMap, 1);
    };
    const renderStaffRow = (row, data) => {
        row.dataset.staffMemberRow = "";
        row.dataset.name = data.name;
        row.dataset.email = data.email;
        row.dataset.phone = data.phone;
        row.dataset.location = "Star Salon";
        row.dataset.role = data.role;
        row.dataset.status = "Aktif";
        row.dataset.bookingEnabled = data.bookingEnabled ? "1" : "0";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.innerHTML = `
            <div class="staff-member-cell staff-member-cell--person">
                <div class="staff-member-avatar">${data.photo ? `<img src="${escapeHtml(data.photo)}" alt="">` : '<i class="bi bi-person"></i>'}</div>
                <strong>${escapeHtml(data.name)}</strong>
            </div>
            <div class="staff-member-cell staff-member-cell--link">${escapeHtml(data.email)}</div>
            <div class="staff-member-cell staff-member-cell--link">${escapeHtml(data.phone)}</div>
            <div class="staff-member-cell">${escapeHtml(data.role)}</div>
            <div class="staff-member-cell">${data.bookingEnabled ? "Kalender Pemesanan diaktifkan" : "Kalender belum diaktifkan"}</div>
        `;
    };

    tabButtons.forEach((button) => {
        button.addEventListener("click", () => switchPanel(button.dataset.staffNewTab || "details"));
    });

    modalEl.querySelectorAll(".staff-new-segmented").forEach((group) => {
        group.addEventListener("click", (event) => {
            const button = event.target instanceof HTMLElement ? event.target.closest("button") : null;
            if (!button || !group.contains(button)) return;
            Array.from(group.querySelectorAll("button")).forEach((item) => item.classList.toggle("is-active", item === button));
        });
    });

    photoButton?.addEventListener("click", () => photoInput?.click());
    photoInput?.addEventListener("change", () => {
        const file = photoInput.files?.[0];
        if (!file || !photoPreview) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            photoDataUrl = String(reader.result || "");
            photoPreview.innerHTML = `<img src="${photoDataUrl}" alt="">`;
        });
        reader.readAsDataURL(file);
    });

    modalEl.querySelectorAll(".js-staff-date-button").forEach((button) => {
        button.addEventListener("click", () => {
            const input = button.dataset.dateTarget === "end" ? endDate : startDate;
            if (typeof input?.showPicker === "function") {
                input.showPicker();
            } else {
                input?.click();
                input?.focus();
            }
        });
    });
    [startDate, endDate].forEach((input) => {
        input?.addEventListener("change", () => {
            const button = modalEl.querySelector(`[data-date-target="${input === endDate ? "end" : "start"}"] span`);
            if (button) {
                button.innerHTML = `<i class="bi bi-calendar3"></i> ${input.value || "Pilih hari"}`;
            }
        });
    });

    const syncBookingSwitch = () => {
        bookingSwitch?.classList.toggle("is-active", Boolean(bookingToggle?.checked));
    };
    bookingSwitch?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!bookingToggle) return;
        bookingToggle.checked = !bookingToggle.checked;
        syncBookingSwitch();
    });
    bookingToggle?.addEventListener("change", syncBookingSwitch);

    modalEl.querySelector(".staff-color-grid")?.addEventListener("click", (event) => {
        const button = event.target instanceof HTMLElement ? event.target.closest("button") : null;
        if (!button || button.classList.contains("staff-color-grid__add")) return;
        modalEl.querySelectorAll(".staff-color-grid button").forEach((item) => item.classList.toggle("is-active", item === button));
    });

    serviceAll?.addEventListener("change", () => {
        serviceChecks.forEach((check) => {
            check.checked = serviceAll.checked;
        });
    });
    serviceChecks.forEach((check) => {
        check.addEventListener("change", () => {
            if (serviceAll) {
                serviceAll.checked = serviceChecks.every((item) => item.checked);
            }
        });
    });

    const syncLocations = () => {
        if (locationAll) {
            locationAll.checked = locationChecks.length > 0 && locationChecks.every((check) => check.checked);
        }
    };
    locationAll?.addEventListener("change", () => {
        locationChecks.forEach((check) => {
            check.checked = locationAll.checked;
        });
    });
    locationChecks.forEach((check) => check.addEventListener("change", syncLocations));
    locationSearch?.addEventListener("input", () => {
        const query = (locationSearch.value || "").toLowerCase();
        modalEl.querySelectorAll("[data-location-row]").forEach((row) => {
            row.hidden = query && !row.textContent.toLowerCase().includes(query);
        });
    });

    const applyCommissionFilters = () => {
        const query = (commissionSearch?.value || "").toLowerCase();
        const assignedOnly = Boolean(commissionAssigned?.checked);
        const selectedServices = new Set(serviceChecks.filter((check) => check.checked).map((check) => check.value));
        commissionRows.forEach((row) => {
            const matchesKind = (row.dataset.commissionKind || "service") === activeCommissionTarget;
            const matchesQuery = !query || row.textContent.toLowerCase().includes(query);
            const matchesAssigned = activeCommissionTarget !== "service" || !assignedOnly || selectedServices.has(row.dataset.serviceId || "");
            row.hidden = !matchesKind || !matchesQuery || !matchesAssigned;
        });
    };

    const parseCommissionValue = (value) => {
        const normalized = String(value || "0").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
        return Number.parseFloat(normalized) || 0;
    };
    const formatCommissionPercent = (value) => {
        const number = parseCommissionValue(value);
        return Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
    };
    const formatCommissionAmount = (value) => `Rp ${parseCommissionValue(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
    const commissionTypeLabel = () => {
        const activeType = modalEl.querySelector("[data-commission-type].is-active")?.dataset.commissionType || "percent";
        const value = commissionValue?.value || "0";
        return activeType === "amount" ? formatCommissionAmount(value) : `${formatCommissionPercent(value)}%`;
    };
    const formatCommissionField = (input, type) => {
        if (!input) return;
        input.value = type === "amount" ? formatCommissionAmount(input.value) : formatCommissionPercent(input.value);
    };
    const copyDefaultCommissionToRows = () => {
        const activeType = modalEl.querySelector("[data-commission-type].is-active")?.dataset.commissionType || "percent";
        const value = commissionValue?.value || "0";
        commissionRows.forEach((row) => {
            if ((row.dataset.commissionKind || "service") !== activeCommissionTarget) {
                return;
            }
            const input = row.querySelector("input");
            if (input) input.value = value;
            const typeButton = row.querySelector(`[data-row-commission-type="${activeType}"]`);
            if (typeButton) {
                setCommissionType(typeButton.parentElement, typeButton);
            }
        });
    };
    const syncDefaultCommissionMode = () => {
        const useDefault = Boolean(commissionUseDefault?.checked);
        if (commissionValue) {
            commissionValue.disabled = !useDefault;
        }
        modalEl.querySelectorAll("[data-commission-type]").forEach((button) => {
            button.disabled = !useDefault;
        });
        modalEl.querySelectorAll(".staff-commission-input--row").forEach((container) => {
            container.classList.toggle("is-disabled", useDefault);
            container.querySelectorAll("input, button").forEach((control) => {
                control.disabled = useDefault;
            });
        });
        if (useDefault) {
            copyDefaultCommissionToRows();
        }
    };
    const setCommissionType = (container, activeButton) => {
        container.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", button === activeButton));
        const type = activeButton.dataset.commissionType || activeButton.dataset.rowCommissionType || "percent";
        formatCommissionField(container.querySelector("input"), type === "amount" ? "amount" : "percent");
    };

    const openCommissionEditor = (target, labelButton) => {
        activeCommissionTarget = target || "all";
        activeCommissionLabelTarget = labelButton || null;
        if (commissionEditorTitle) {
            commissionEditorTitle.textContent = commissionTitles[activeCommissionTarget] || "Komisi per Layanan";
        }
        const copy = commissionCopy[activeCommissionTarget] || commissionCopy.service;
        if (commissionDefaultLabel) {
            commissionDefaultLabel.textContent = copy.defaultLabel;
        }
        if (commissionUseDefaultLabel) {
            commissionUseDefaultLabel.textContent = copy.checkboxLabel;
        }
        if (commissionAssigned) {
            commissionAssigned.closest(".staff-commission-assigned").hidden = activeCommissionTarget !== "service";
            commissionAssigned.checked = false;
        }
        applyCommissionFilters();
        if (commissionEditor) {
            commissionEditor.hidden = false;
        }
    };
    const closeCommissionEditor = () => {
        if (commissionEditor) {
            commissionEditor.hidden = true;
        }
        if (commissionConfirm) {
            commissionConfirm.hidden = true;
        }
    };

    modalEl.querySelectorAll("[data-commission-edit]").forEach((button) => {
        button.addEventListener("click", () => openCommissionEditor(button.dataset.commissionEdit || "service", button));
    });
    modalEl.querySelectorAll(".js-staff-commission-cancel").forEach((button) => {
        button.addEventListener("click", closeCommissionEditor);
    });
    modalEl.querySelectorAll("[data-commission-type]").forEach((button) => {
        button.addEventListener("click", () => {
            setCommissionType(button.parentElement, button);
            if (commissionUseDefault?.checked) {
                copyDefaultCommissionToRows();
            }
        });
    });
    modalEl.querySelectorAll("[data-row-commission-type]").forEach((button) => {
        button.addEventListener("click", () => setCommissionType(button.parentElement, button));
    });
    commissionRows.forEach((row) => {
        const input = row.querySelector("input");
        input?.addEventListener("input", () => {
            const activeType = row.querySelector("[data-row-commission-type].is-active")?.dataset.rowCommissionType || "percent";
            if (activeType === "amount") {
                input.value = formatCommissionAmount(input.value);
            }
        });
        input?.addEventListener("blur", () => {
            const activeType = row.querySelector("[data-row-commission-type].is-active")?.dataset.rowCommissionType || "percent";
            formatCommissionField(input, activeType === "amount" ? "amount" : "percent");
        });
    });
    commissionValue?.addEventListener("input", () => {
        const activeType = modalEl.querySelector("[data-commission-type].is-active")?.dataset.commissionType || "percent";
        if (activeType === "amount") {
            commissionValue.value = formatCommissionAmount(commissionValue.value);
        }
        if (commissionUseDefault?.checked) {
            copyDefaultCommissionToRows();
        }
    });
    commissionValue?.addEventListener("blur", () => {
        const activeType = modalEl.querySelector("[data-commission-type].is-active")?.dataset.commissionType || "percent";
        formatCommissionField(commissionValue, activeType === "amount" ? "amount" : "percent");
        if (commissionUseDefault?.checked) {
            copyDefaultCommissionToRows();
        }
    });
    commissionUseDefault?.addEventListener("change", () => {
        if (commissionUseDefault.checked) {
            commissionUseDefault.checked = false;
            const copy = commissionCopy[activeCommissionTarget] || commissionCopy.service;
            if (commissionConfirmItem) {
                commissionConfirmItem.textContent = copy.confirmItem;
            }
            if (commissionConfirmValue) {
                commissionConfirmValue.textContent = commissionTypeLabel();
            }
            if (commissionConfirm) {
                commissionConfirm.hidden = false;
            }
            return;
        }
        syncDefaultCommissionMode();
    });
    modalEl.querySelectorAll(".js-staff-commission-confirm-cancel").forEach((button) => {
        button.addEventListener("click", () => {
            if (commissionConfirm) {
                commissionConfirm.hidden = true;
            }
            if (commissionUseDefault) {
                commissionUseDefault.checked = false;
            }
            syncDefaultCommissionMode();
        });
    });
    modalEl.querySelector(".js-staff-commission-confirm-continue")?.addEventListener("click", () => {
        if (commissionConfirm) {
            commissionConfirm.hidden = true;
        }
        if (commissionUseDefault) {
            commissionUseDefault.checked = true;
        }
        syncDefaultCommissionMode();
    });
    syncDefaultCommissionMode();
    commissionSearch?.addEventListener("input", applyCommissionFilters);
    commissionAssigned?.addEventListener("change", applyCommissionFilters);
    modalEl.querySelector(".js-staff-commission-done")?.addEventListener("click", () => {
        const activeType = modalEl.querySelector("[data-commission-type].is-active")?.dataset.commissionType || "percent";
        const value = (commissionValue?.value || "0").trim() || "0";
        const label = activeType === "amount" ? formatCommissionAmount(value) : `${formatCommissionPercent(value)}%`;
        if (activeCommissionTarget === "all" && commissionSummary) {
            commissionSummary.textContent = label;
        } else if (activeCommissionLabelTarget) {
            const summary = activeCommissionLabelTarget.previousElementSibling;
            activeCommissionLabelTarget.textContent = "Ganti";
            if (summary) {
                summary.textContent = `${summary.textContent.split(" - ")[0]} - ${label}`;
            }
        }
        closeCommissionEditor();
    });

    const selectedRole = () => modalEl.querySelector("[data-staff-new-role].is-active")?.dataset.staffNewRole || "Basic";
    const resetForm = () => {
        activeEditRow = null;
        if (modalTitle) modalTitle.textContent = "Staf Baru";
        if (deleteBtn) deleteBtn.hidden = true;
        if (saveBtn) saveBtn.textContent = "Simpan";
        if (nameInput) nameInput.value = "";
        if (phoneInput) phoneInput.value = "+62";
        if (emailInput) emailInput.value = "";
        if (titleInput) titleInput.value = "";
        photoDataUrl = "";
        if (photoInput) photoInput.value = "";
        if (photoPreview) photoPreview.innerHTML = '<i class="bi bi-person"></i>';
        setActiveButton(Array.from(modalEl.querySelectorAll(".customer-segmented button")), (_button, index) => index === 0, 0);
        setRoleSelection("Basic");
        if (bookingToggle) bookingToggle.checked = true;
        syncBookingSwitch();
        setDateButtonText("start", startDate?.value || "");
        setDateButtonText("end", endDate?.value || "");
        serviceChecks.forEach((check) => { check.checked = true; });
        if (serviceAll) serviceAll.checked = true;
        locationChecks.forEach((check) => { check.checked = true; });
        syncLocations();
        if (commissionUseDefault) commissionUseDefault.checked = false;
        if (commissionValue) commissionValue.value = "0";
        modalEl.querySelectorAll(".staff-commission-input").forEach((container) => {
            const percentButton = container.querySelector("[data-commission-type='percent'], [data-row-commission-type='percent']");
            const input = container.querySelector("input");
            if (input) input.value = "0";
            if (percentButton) setCommissionType(container, percentButton);
        });
        syncDefaultCommissionMode();
        switchPanel("details");
        closeCommissionEditor();
    };
    const fillFormFromRow = (row) => {
        activeEditRow = row;
        if (modalTitle) modalTitle.textContent = "Edit Staff";
        if (deleteBtn) deleteBtn.hidden = false;
        if (saveBtn) saveBtn.textContent = "Simpan";
        const name = row.dataset.name || "";
        const email = row.dataset.email || "";
        const phone = normalizePhone(row.dataset.phone || "");
        const role = row.dataset.role || "";
        const bookingEnabled = row.dataset.bookingEnabled !== "0";
        const photo = row.querySelector(".staff-member-avatar img")?.getAttribute("src") || "";

        if (nameInput) nameInput.value = name;
        if (emailInput) emailInput.value = email;
        if (phoneInput) phoneInput.value = phone;
        if (titleInput) titleInput.value = role;
        photoDataUrl = photo;
        if (photoInput) photoInput.value = "";
        if (photoPreview) photoPreview.innerHTML = photo ? `<img src="${escapeHtml(photo)}" alt="">` : '<i class="bi bi-person"></i>';
        if (bookingToggle) bookingToggle.checked = bookingEnabled;
        syncBookingSwitch();
        setRoleSelection(role);
        switchPanel("details");
        closeCommissionEditor();
    };

    modalEl.querySelector(".js-staff-fab")?.addEventListener("click", resetForm);
    shell.querySelector(".js-staff-fab")?.addEventListener("click", resetForm);
    memberList?.addEventListener("click", (event) => {
        const row = event.target instanceof HTMLElement ? event.target.closest("[data-staff-member-row]") : null;
        if (!row || !memberList.contains(row)) return;
        fillFormFromRow(row);
        modal?.show();
    });
    memberList?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const row = event.target instanceof HTMLElement ? event.target.closest("[data-staff-member-row]") : null;
        if (!row || !memberList.contains(row)) return;
        event.preventDefault();
        fillFormFromRow(row);
        modal?.show();
    });
    deleteBtn?.addEventListener("click", () => {
        if (!activeEditRow) return;
        activeEditRow.remove();
        activeEditRow = null;
        resetForm();
        modal?.hide();
    });

    saveBtn?.addEventListener("click", () => {
        const name = (nameInput?.value || "").trim();
        if (!name) {
            nameInput?.focus();
            return;
        }

        const email = (emailInput?.value || "").trim() || "-";
        const phone = (phoneInput?.value || "").trim() || "+62";
        const role = (titleInput?.value || "").trim() || selectedRole();
        const row = activeEditRow || document.createElement("div");
        renderStaffRow(row, {
            name,
            email,
            phone,
            role,
            photo: photoDataUrl,
            bookingEnabled: Boolean(bookingToggle?.checked),
        });
        if (!activeEditRow) {
            memberList?.prepend(row);
        }

        if (!activeEditRow && commissionStaffMenu) {
            const item = document.createElement("button");
            item.className = "dropdown-item";
            item.type = "button";
            item.dataset.commissionStaff = name;
            item.textContent = name;
            commissionStaffMenu.appendChild(item);
        }

        resetForm();
        modal?.hide();
    });
}

function initStaffToolbarActions(shell) {
    const text = (value) => String(value || "").toLowerCase();
    const formatYmd = (date) => {
        const pad = (value) => String(value).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    };
    const canUseBootstrapDropdown = typeof bootstrap !== "undefined" && Boolean(bootstrap.Dropdown);
    const setButtonText = (button, value) => {
        const span = button?.querySelector("span");
        if (span) {
            span.textContent = value;
        } else if (button) {
            button.childNodes.forEach((node) => {
                if (node.nodeType === Node.TEXT_NODE) node.textContent = "";
            });
            button.prepend(document.createTextNode(value));
        }
    };

    shell.querySelectorAll(".dropdown").forEach((dropdown) => {
        const toggle = dropdown.querySelector(".ss-dropdown-toggle");
        const items = Array.from(dropdown.querySelectorAll(".dropdown-item"));
        if (!canUseBootstrapDropdown) {
            toggle?.addEventListener("click", (event) => {
                event.stopPropagation();
                shell.querySelectorAll(".dropdown.is-open").forEach((openDropdown) => {
                    if (openDropdown !== dropdown) openDropdown.classList.remove("is-open");
                });
                dropdown.classList.toggle("is-open");
            });
        }
        items.forEach((item) => {
            item.addEventListener("click", () => {
                items.forEach((candidate) => candidate.classList.toggle("is-active", candidate === item));
                dropdown.classList.remove("is-open");
                setButtonText(toggle, item.textContent.trim());
            });
        });
    });
    if (!canUseBootstrapDropdown) {
        document.addEventListener("click", (event) => {
            if (event.target instanceof Node && shell.contains(event.target)) return;
            shell.querySelectorAll(".dropdown.is-open").forEach((dropdown) => dropdown.classList.remove("is-open"));
        });
    }

    const memberRows = Array.from(shell.querySelectorAll("[data-staff-member-row]"));
    const memberList = shell.querySelector(".staff-member-list");
    const memberSearch = shell.querySelector(".js-staff-member-search");
    const memberRoleFilter = shell.querySelector(".js-staff-member-role-filter");
    const memberSortToggle = shell.querySelector(".js-staff-member-sort-toggle");
    const memberNameSort = shell.querySelector(".js-staff-member-name-sort");
    const memberExport = shell.querySelector(".js-staff-member-export");
    const memberRoleItems = Array.from(shell.querySelectorAll("[data-staff-member-role]"));
    const memberSortItems = Array.from(shell.querySelectorAll("[data-staff-member-sort]"));
    const memberFieldItems = Array.from(shell.querySelectorAll("[data-staff-member-field]"));
    const memberExportItems = Array.from(shell.querySelectorAll("[data-staff-member-export]"));
    let activeRole = "all";
    let activeMemberField = "name";
    let activeSortDir = "asc";

    const applyMemberFilters = () => {
        const query = text(memberSearch?.value);
        memberRows.forEach((row) => {
            const matchesQuery = !query || text(row.dataset[activeMemberField]).includes(query);
            const matchesRole = activeRole === "all" || row.dataset.role === activeRole;
            row.hidden = !matchesQuery || !matchesRole;
        });
    };

    const sortMembers = (dir = activeSortDir, field = activeMemberField) => {
        if (!memberList) return;
        const multiplier = dir === "desc" ? -1 : 1;
        memberRows
            .sort((a, b) => multiplier * String(a.dataset[field] || "").localeCompare(String(b.dataset[field] || "")))
            .forEach((row) => memberList.appendChild(row));
        applyMemberFilters();
    };

    const memberCsvLines = () => {
        const visibleRows = memberRows.filter((row) => !row.hidden);
        return [
            ["Nama", "Email", "Telepon", "Role", "Lokasi", "Status"],
            ...visibleRows.map((row) => [row.dataset.name, row.dataset.email, row.dataset.phone, row.dataset.role, row.dataset.location, row.dataset.status]),
        ];
    };

    const downloadBlob = (filename, type, content) => {
        const blob = new Blob([content], { type });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 250);
    };

    const exportMembers = (format) => {
        const rows = memberCsvLines();
        const csv = rows.map((line) => line.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const tableHtml = `<table><tbody>${rows.map((line) => `<tr>${line.map((cell) => `<td>${String(cell || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        if (format === "pdf") {
            const win = window.open("", "_blank", "width=900,height=700");
            if (!win) return;
            win.document.write(`<html><head><title>Staff</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:8px}</style></head><body>${tableHtml}<script>window.print();</script></body></html>`);
            win.document.close();
            return;
        }
        if (format === "xls" || format === "xlsx") {
            downloadBlob(`staff.${format}`, "application/vnd.ms-excel;charset=utf-8", tableHtml);
            return;
        }
        downloadBlob("staff.csv", "text/csv;charset=utf-8", csv);
    };

    memberSearch?.addEventListener("input", applyMemberFilters);
    memberRoleItems.forEach((item) => {
        item.addEventListener("click", () => {
            activeRole = item.dataset.staffMemberRole || "all";
            setButtonText(memberRoleFilter, activeRole === "all" ? "Roles" : activeRole);
            applyMemberFilters();
        });
    });
    memberSortItems.forEach((item) => {
        item.addEventListener("click", () => {
            activeSortDir = item.dataset.staffMemberSort || "asc";
            setButtonText(memberSortToggle, activeSortDir === "asc" ? "A-Z" : "Z-A");
            sortMembers(activeSortDir, activeMemberField);
        });
    });
    memberFieldItems.forEach((item) => {
        item.addEventListener("click", () => {
            activeMemberField = item.dataset.staffMemberField || "name";
            setButtonText(memberNameSort, item.textContent.trim());
            sortMembers(activeSortDir, activeMemberField);
        });
    });
    memberExportItems.forEach((item) => {
        item.addEventListener("click", () => {
            exportMembers(item.dataset.staffMemberExport || "csv");
            setButtonText(memberExport, "Unduh");
        });
    });

    const attendancePanel = shell.querySelector('[data-staff-panel="attendance"]');
    const attendanceViews = Array.from(shell.querySelectorAll("[data-staff-attendance-view]"));
    const attendanceStaffRows = Array.from(shell.querySelectorAll("[data-staff-attendance-row]"));
    const attendanceRecordRows = Array.from(shell.querySelectorAll("[data-staff-attendance-record]"));
    const attendanceSearch = shell.querySelector(".js-staff-attendance-search");
    const attendanceModeButtons = Array.from(shell.querySelectorAll("[data-staff-attendance-mode]"));
    const attendanceExport = shell.querySelector(".js-staff-attendance-export");
    const attendanceExportItems = Array.from(shell.querySelectorAll("[data-staff-attendance-export]"));
    const attendanceRangeButton = shell.querySelector(".js-staff-attendance-range");
    const attendanceFab = shell.querySelector(".js-staff-attendance-fab");
    const attendanceTableBody = shell.querySelector(".staff-attendance-table tbody");
    const attendanceDetailDrawerEl = document.getElementById("staffAttendanceDetailDrawer");
    const newAttendanceModalEl = document.getElementById("staffNewAttendanceModal");
    const newAttendanceModal = newAttendanceModalEl && typeof bootstrap !== "undefined" ? bootstrap.Modal.getOrCreateInstance(newAttendanceModalEl) : null;
    let attendanceMode = "staff";
    let mutableAttendanceRows = attendanceRecordRows.slice();
    const applyAttendanceFilter = () => {
        const query = text(attendanceSearch?.value);
        attendanceStaffRows.forEach((row) => {
            const matchesQuery = !query || text(row.dataset.name).includes(query);
            row.hidden = attendanceMode !== "staff" || !matchesQuery;
        });
        mutableAttendanceRows.forEach((row) => {
            const matchesQuery = !query || text(row.dataset.name).includes(query);
            row.hidden = attendanceMode !== "attendance" || !matchesQuery;
        });
    };
    const applyAttendanceMode = (mode) => {
        attendanceMode = mode || "staff";
        attendanceModeButtons.forEach((modeButton) => {
            modeButton.classList.toggle("is-active", modeButton.dataset.staffAttendanceMode === attendanceMode);
        });
        attendanceViews.forEach((view) => {
            view.hidden = view.dataset.staffAttendanceView !== attendanceMode;
        });
        attendancePanel?.classList.toggle("is-attendance-mode", attendanceMode === "attendance");
        if (attendanceFab) attendanceFab.hidden = attendanceMode !== "attendance";
        if (attendanceSearch) attendanceSearch.value = "";
        applyAttendanceFilter();
    };
    const attendanceRowsForExport = () => mutableAttendanceRows
        .filter((row) => !row.hidden)
        .map((row) => Array.from(row.querySelectorAll("td")).slice(0, -1).map((cell) => cell.textContent.trim().replace(/\s+/g, " ")));
    const exportAttendance = (format) => {
        const rows = [
            ["Date", "Staff", "Shift", "Clock In", "Clock Out", "Duration", "Early", "Late", "Overtime", "Source", "Clock In Selfie", "Clock Out Selfie"],
            ...attendanceRowsForExport(),
        ];
        const csv = rows.map((line) => line.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const tableHtml = `<table><tbody>${rows.map((line) => `<tr>${line.map((cell) => `<td>${String(cell || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        if (format === "pdf") {
            const win = window.open("", "_blank", "width=900,height=700");
            if (!win) return;
            win.document.write(`<html><head><title>Attendance</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:8px}</style></head><body>${tableHtml}<script>window.print();</script></body></html>`);
            win.document.close();
            return;
        }
        if (format === "xls" || format === "xlsx") {
            downloadBlob(`attendance.${format}`, "application/vnd.ms-excel;charset=utf-8", tableHtml);
            return;
        }
        downloadBlob("attendance.csv", "text/csv;charset=utf-8", csv);
    };
    attendanceSearch?.addEventListener("input", applyAttendanceFilter);
    attendanceModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            applyAttendanceMode(button.dataset.staffAttendanceMode || "staff");
        });
    });
    attendanceExportItems.forEach((item) => {
        item.addEventListener("click", () => {
            exportAttendance(item.dataset.staffAttendanceExport || "csv");
            setButtonText(attendanceExport, "Export");
        });
    });
    if (attendanceDetailDrawerEl) {
        const detailName = attendanceDetailDrawerEl.querySelector(".js-attendance-detail-name");
        const detailToggle = attendanceDetailDrawerEl.querySelector(".js-attendance-detail-toggle");
        const detailDone = attendanceDetailDrawerEl.querySelector(".js-attendance-detail-done");
        const detailCards = Array.from(attendanceDetailDrawerEl.querySelectorAll("[data-attendance-pose-card]"));
        const detailSelectButtons = Array.from(attendanceDetailDrawerEl.querySelectorAll("[data-attendance-pose-select]"));
        const detailUploadButtons = Array.from(attendanceDetailDrawerEl.querySelectorAll("[data-attendance-pose-upload]"));
        const detailDeleteButtons = Array.from(attendanceDetailDrawerEl.querySelectorAll("[data-attendance-pose-delete]"));
        const detailState = {
            row: null,
            name: "",
            pose: "Right Tilt",
            uploaded: "",
            active: true,
        };
        const syncAttendanceDetailDrawer = () => {
            if (detailName) detailName.textContent = detailState.name || "Staf";
            if (detailToggle) detailToggle.checked = detailState.active;
            detailCards.forEach((card) => {
                const pose = card.dataset.attendancePoseCard || "";
                const isActive = pose === detailState.pose;
                const hasPhoto = detailState.uploaded === pose;
                card.classList.toggle("is-active", isActive);
                card.classList.toggle("has-photo", hasPhoto);
            });
        };
        const closeAttendanceDetailDrawer = () => {
            attendanceDetailDrawerEl.classList.remove("is-open");
            attendanceDetailDrawerEl.setAttribute("aria-hidden", "true");
            window.setTimeout(() => {
                if (!attendanceDetailDrawerEl.classList.contains("is-open")) {
                    attendanceDetailDrawerEl.hidden = true;
                }
            }, 180);
        };
        const openAttendanceDetailDrawer = (name) => {
            const staffRow = attendanceStaffRows.find((row) => row.dataset.name === name) || null;
            detailState.row = staffRow;
            detailState.name = name || staffRow?.dataset.name || "Staf";
            detailState.pose = staffRow?.dataset.attendancePose || "Right Tilt";
            detailState.uploaded = staffRow?.dataset.attendanceUploadedPose || "";
            detailState.active = (staffRow?.dataset.status || "Aktif") === "Aktif";
            syncAttendanceDetailDrawer();
            attendanceDetailDrawerEl.hidden = false;
            attendanceDetailDrawerEl.setAttribute("aria-hidden", "false");
            window.requestAnimationFrame(() => {
                attendanceDetailDrawerEl.classList.add("is-open");
            });
        };
        const commitAttendanceDetail = () => {
            const staffRow = detailState.row;
            if (!staffRow) {
                closeAttendanceDetailDrawer();
                return;
            }
            const nextStatus = detailState.active ? "Aktif" : "Nonaktif";
            const nextStatusLabel = detailState.active ? "Active" : "Deactive";
            staffRow.dataset.status = nextStatus;
            staffRow.dataset.attendancePose = detailState.pose;
            staffRow.dataset.attendanceUploadedPose = detailState.uploaded;
            const faceCell = staffRow.querySelector("[data-attendance-face-cell]");
            const statusPill = staffRow.querySelector("[data-attendance-status-pill]");
            const lastModified = staffRow.querySelector("[data-attendance-last-modified]");
            if (faceCell) {
                faceCell.textContent = detailState.uploaded ? detailState.uploaded : "-";
            }
            if (statusPill) {
                statusPill.textContent = nextStatusLabel;
                statusPill.classList.toggle("is-inactive", !detailState.active);
            }
            if (lastModified) {
                lastModified.textContent = "23 Apr 2026";
            }
            attendanceRecordRows.forEach((row) => {
                if ((row.dataset.name || "") === detailState.name) {
                    row.dataset.status = nextStatus;
                }
            });
            closeAttendanceDetailDrawer();
        };
        shell.querySelectorAll("[data-attendance-edit]").forEach((button) => {
            button.addEventListener("click", () => {
                openAttendanceDetailDrawer(button.dataset.attendanceEdit || "");
            });
        });
        detailSelectButtons.forEach((button) => {
            button.addEventListener("click", () => {
                detailState.pose = button.dataset.attendancePoseSelect || "Right Tilt";
                syncAttendanceDetailDrawer();
            });
        });
        detailUploadButtons.forEach((button) => {
            button.addEventListener("click", () => {
                detailState.pose = button.dataset.attendancePoseUpload || detailState.pose;
                detailState.uploaded = detailState.pose;
                syncAttendanceDetailDrawer();
            });
        });
        detailDeleteButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const pose = button.dataset.attendancePoseDelete || "";
                if (detailState.uploaded === pose) {
                    detailState.uploaded = "";
                }
                detailState.pose = pose || detailState.pose;
                syncAttendanceDetailDrawer();
            });
        });
        detailToggle?.addEventListener("change", () => {
            detailState.active = Boolean(detailToggle.checked);
        });
        attendanceDetailDrawerEl.querySelectorAll(".js-attendance-detail-close").forEach((button) => {
            button.addEventListener("click", closeAttendanceDetailDrawer);
        });
        detailDone?.addEventListener("click", commitAttendanceDetail);
    }
    const timeToMinutes = (value) => {
        const [hours, minutes] = String(value || "00:00").split(":").map((part) => Number.parseInt(part, 10) || 0);
        return (hours * 60) + minutes;
    };
    const minutesToLabel = (minutes) => {
        if (minutes <= 0) return "-";
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours && mins) return `${hours}h ${mins}m`;
        if (hours) return `${hours}h`;
        return `${mins}m`;
    };
    const makeSelfieCell = () => '<span class="staff-attendance-selfie"><i class="bi bi-person"></i></span><span>0.00%</span>';
    const escapeCell = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    })[char]);
    const createAttendanceRow = ({ date, staffName, shiftStart, shiftEnd, clockIn, clockOut }) => {
        const shiftStartMinutes = timeToMinutes(shiftStart);
        const shiftEndMinutes = timeToMinutes(shiftEnd);
        const clockInMinutes = timeToMinutes(clockIn);
        const clockOutMinutes = timeToMinutes(clockOut);
        const lateMinutes = Math.max(0, clockInMinutes - shiftStartMinutes);
        const earlyMinutes = Math.max(0, shiftEndMinutes - clockOutMinutes);
        const overtimeMinutes = Math.max(0, clockOutMinutes - shiftEndMinutes);
        const durationMinutes = Math.max(0, clockOutMinutes - clockInMinutes);
        const row = document.createElement("tr");
        row.dataset.staffAttendanceRecord = "";
        row.dataset.name = staffName;
        row.dataset.status = lateMinutes > 0 ? "Late" : (overtimeMinutes > 0 ? "Overtime" : "Ontime");
        row.innerHTML = `
            <td class="staff-attendance-date-col">${escapeCell(date)}</td>
            <td><button class="staff-attendance-name" type="button">${escapeCell(staffName)}</button></td>
            <td>${shiftStart} - ${shiftEnd}</td>
            <td>${clockIn}</td>
            <td>${clockOut}</td>
            <td>${minutesToLabel(durationMinutes)}</td>
            <td>${minutesToLabel(earlyMinutes)}</td>
            <td>${minutesToLabel(lateMinutes)}</td>
            <td>${minutesToLabel(overtimeMinutes)}</td>
            <td>${row.dataset.status}</td>
            <td>${makeSelfieCell()}</td>
            <td>${makeSelfieCell()}</td>
            <td><button class="staff-attendance-edit-btn" type="button" data-attendance-edit="${escapeCell(staffName)}" aria-label="Edit ${escapeCell(staffName)}"><i class="bi bi-pencil"></i></button></td>
        `;
        row.querySelector("[data-attendance-edit]")?.addEventListener("click", () => {
            const memberRow = Array.from(shell.querySelectorAll("[data-staff-member-row]")).find((staffRow) => staffRow.dataset.name === staffName);
            memberRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });
        return row;
    };
    if (newAttendanceModalEl) {
        const dateInput = newAttendanceModalEl.querySelector(".js-new-attendance-date");
        const dateButton = newAttendanceModalEl.querySelector(".js-new-attendance-date-button");
        const staffSelect = newAttendanceModalEl.querySelector(".js-new-attendance-staff");
        const saveAttendance = newAttendanceModalEl.querySelector(".js-new-attendance-save");
        const timeFields = Array.from(newAttendanceModalEl.querySelectorAll(".js-staff-time-field"));
        const timePicker = newAttendanceModalEl.querySelector(".js-staff-time-picker");
        const hourList = newAttendanceModalEl.querySelector(".js-staff-time-hour");
        const minuteList = newAttendanceModalEl.querySelector(".js-staff-time-minute");
        const timeValues = { shiftStart: "08:00", shiftEnd: "17:00", clockIn: "08:00", clockOut: "17:00" };
        let activeTimeTarget = "shiftStart";
        const updateTimeButton = (target) => {
            const field = timeFields.find((button) => button.dataset.timeTarget === target);
            const span = field?.querySelector("span");
            if (span) span.textContent = timeValues[target] || "00:00";
        };
        const setTime = (target, hours, minutes) => {
            timeValues[target] = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
            updateTimeButton(target);
        };
        const keepTimePickerOpen = (event) => {
            event.stopPropagation();
        };
        const renderTimePicker = () => {
            if (!hourList || !minuteList) return;
            const [activeHour, activeMinute] = (timeValues[activeTimeTarget] || "00:00").split(":").map(Number);
            hourList.innerHTML = Array.from({ length: 24 }, (_, hour) => `<button class="${hour === activeHour ? "is-active" : ""}" type="button" data-hour="${hour}">${String(hour).padStart(2, "0")}</button>`).join("");
            minuteList.innerHTML = Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => `<button class="${minute === activeMinute ? "is-active" : ""}" type="button" data-minute="${minute}">${String(minute).padStart(2, "0")}</button>`).join("");
        };
        dateButton?.addEventListener("click", () => {
            if (typeof dateInput?.showPicker === "function") dateInput.showPicker();
            else dateInput?.click();
        });
        dateInput?.addEventListener("change", () => {
            const span = dateButton?.querySelector("span");
            if (span) span.innerHTML = `<i class="bi bi-calendar3"></i> ${dateInput.value}`;
        });
        staffSelect?.addEventListener("change", () => {
            staffSelect.classList.toggle("is-invalid", !staffSelect.value);
        });
        timeFields.forEach((field) => {
            field.addEventListener("click", (event) => {
                keepTimePickerOpen(event);
                activeTimeTarget = field.dataset.timeTarget || "shiftStart";
                renderTimePicker();
                if (timePicker) timePicker.hidden = false;
            });
        });
        timePicker?.addEventListener("click", keepTimePickerOpen);
        hourList?.addEventListener("click", (event) => {
            keepTimePickerOpen(event);
            const button = event.target instanceof HTMLElement ? event.target.closest("[data-hour]") : null;
            if (!button) return;
            const [, minute] = (timeValues[activeTimeTarget] || "00:00").split(":").map(Number);
            setTime(activeTimeTarget, Number(button.dataset.hour), minute);
            renderTimePicker();
        });
        minuteList?.addEventListener("click", (event) => {
            keepTimePickerOpen(event);
            const button = event.target instanceof HTMLElement ? event.target.closest("[data-minute]") : null;
            if (!button) return;
            const [hour] = (timeValues[activeTimeTarget] || "00:00").split(":").map(Number);
            setTime(activeTimeTarget, hour, Number(button.dataset.minute));
            renderTimePicker();
        });
        document.addEventListener("click", (event) => {
            if (timePicker?.hidden) return;
            if (event.target instanceof Node && (timePicker.contains(event.target) || timeFields.some((field) => field.contains(event.target)))) return;
            timePicker.hidden = true;
        });
        attendanceFab?.addEventListener("click", () => {
            if (dateInput) dateInput.value = formatYmd(new Date());
            const span = dateButton?.querySelector("span");
            if (span) span.innerHTML = `<i class="bi bi-calendar3"></i> ${dateInput?.value || formatYmd(new Date())}`;
            if (staffSelect) staffSelect.selectedIndex = 0;
            staffSelect?.classList.remove("is-invalid");
            Object.assign(timeValues, { shiftStart: "08:00", shiftEnd: "17:00", clockIn: "08:00", clockOut: "17:00" });
            Object.keys(timeValues).forEach(updateTimeButton);
            if (timePicker) timePicker.hidden = true;
            newAttendanceModal?.show();
        });
        saveAttendance?.addEventListener("click", () => {
            const staffName = staffSelect?.value?.trim() || "";
            if (!staffName) {
                staffSelect?.classList.add("is-invalid");
                staffSelect?.focus();
                return;
            }
            const row = createAttendanceRow({
                date: dateInput?.value || formatYmd(new Date()),
                staffName,
                shiftStart: timeValues.shiftStart,
                shiftEnd: timeValues.shiftEnd,
                clockIn: timeValues.clockIn,
                clockOut: timeValues.clockOut,
            });
            attendanceTableBody?.prepend(row);
            mutableAttendanceRows = [row, ...mutableAttendanceRows];
            applyAttendanceFilter();
            newAttendanceModal?.hide();
        });
    }
    const attendanceDateModal = document.getElementById("staffAttendanceDateFilterModal");
    if (attendanceDateModal) {
        const startInput = attendanceDateModal.querySelector(".js-staff-attendance-start");
        const endInput = attendanceDateModal.querySelector(".js-staff-attendance-end");
        const rangeInput = attendanceDateModal.querySelector(".js-staff-attendance-date-range");
        const resetBtn = attendanceDateModal.querySelector(".js-staff-attendance-date-reset");
        const applyBtn = attendanceDateModal.querySelector(".js-staff-attendance-date-apply");
        const presetButtons = Array.from(attendanceDateModal.querySelectorAll(".js-staff-attendance-date-preset"));
        const attendanceDateModalInstance = typeof bootstrap !== "undefined" ? bootstrap.Modal.getOrCreateInstance(attendanceDateModal) : null;
        const today = new Date();
        let activePreset = "today";
        let fp = null;
        const formatYmdDate = (date) => formatYmd(date);
        const displayDate = (value) => {
            const date = new Date(`${value}T00:00:00`);
            return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
        };
        const setRange = (start, end) => {
            if (startInput) startInput.value = start || "";
            if (endInput) endInput.value = end || "";
            if (fp) {
                fp.setDate([start, end].filter(Boolean), false, "Y-m-d");
            }
        };
        const syncPresetButtons = () => {
            presetButtons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.preset === activePreset);
            });
        };
        const applyRange = ({ closeModal = true } = {}) => {
            const start = startInput?.value || formatYmdDate(today);
            const end = endInput?.value || start;
            const presetLabel = activePreset === "today" ? "Hari ini"
                : activePreset === "yesterday" ? "Kemarin"
                    : activePreset === "this_month" ? "Bulan ini"
                        : activePreset === "30d" ? "30 hari sebelumnya"
                            : activePreset === "last_month" ? "Bulan kemarin"
                                : activePreset === "this_year" ? "Tahun ini"
                                    : activePreset === "last_year" ? "Tahun kemarin"
                                        : activePreset === "7d" ? "7 hari sebelumnya"
                                            : "";
            const label = presetLabel
                ? `${presetLabel}, ${displayDate(start)} - ${displayDate(end)}`
                : `${displayDate(start)} - ${displayDate(end)}`;
            const span = attendanceRangeButton?.querySelector("span");
            if (span) span.textContent = label;
            attendanceRecordRows.forEach((row) => {
                const dateCell = row.querySelector(".staff-attendance-date-col");
                if (dateCell) dateCell.textContent = start;
            });
            if (closeModal) {
                attendanceDateModalInstance?.hide();
            }
        };
        if (typeof flatpickr !== "undefined" && rangeInput) {
            fp = flatpickr(rangeInput, {
                inline: true,
                mode: "range",
                dateFormat: "Y-m-d",
                defaultDate: [startInput?.value || formatYmdDate(today), endInput?.value || formatYmdDate(today)],
                onChange: (selectedDates) => {
                    if (selectedDates[0]) startInput.value = formatYmdDate(selectedDates[0]);
                    if (selectedDates[1]) endInput.value = formatYmdDate(selectedDates[1]);
                    if (selectedDates[0] || selectedDates[1]) {
                        activePreset = "";
                        syncPresetButtons();
                    }
                },
            });
        }
        presetButtons.forEach((button) => {
            button.addEventListener("click", () => {
                activePreset = button.dataset.preset || "today";
                const start = new Date(today);
                const end = new Date(today);
                if (activePreset === "yesterday") {
                    start.setDate(today.getDate() - 1);
                    end.setDate(today.getDate() - 1);
                } else if (activePreset === "7d") {
                    start.setDate(today.getDate() - 6);
                } else if (activePreset === "30d") {
                    start.setDate(today.getDate() - 29);
                } else if (activePreset === "this_month") {
                    start.setDate(1);
                } else if (activePreset === "last_month") {
                    start.setMonth(today.getMonth() - 1, 1);
                    end.setMonth(today.getMonth(), 0);
                } else if (activePreset === "this_year") {
                    start.setMonth(0, 1);
                } else if (activePreset === "last_year") {
                    start.setFullYear(today.getFullYear() - 1, 0, 1);
                    end.setFullYear(today.getFullYear() - 1, 11, 31);
                }
                setRange(formatYmdDate(start), formatYmdDate(end));
                syncPresetButtons();
                applyRange();
            });
        });
        startInput?.addEventListener("change", () => {
            activePreset = "";
            syncPresetButtons();
            setRange(startInput.value, endInput?.value || "");
        });
        endInput?.addEventListener("change", () => {
            activePreset = "";
            syncPresetButtons();
            setRange(startInput?.value || "", endInput.value);
        });
        resetBtn?.addEventListener("click", () => {
            activePreset = "today";
            setRange(formatYmdDate(today), formatYmdDate(today));
            syncPresetButtons();
        });
        syncPresetButtons();
        applyBtn?.addEventListener("click", () => applyRange());
    }
    applyAttendanceMode("staff");

    const commissionRangeButton = shell.querySelector(".js-staff-commission-range");
    const commissionRange = commissionRangeButton?.querySelector("span");
    const commissionStaff = shell.querySelector(".js-staff-commission-staff-filter");
    const commissionStaffMenu = commissionStaff?.closest(".dropdown")?.querySelector(".ss-dropdown-menu");
    const commissionSearch = shell.querySelector(".js-staff-commission-search");
    const commissionRows = Array.from(shell.querySelectorAll("[data-commission-row]"));
    const commissionEmpty = shell.querySelector("[data-commission-empty]");
    const commissionAdjustModalEl = document.getElementById("staffCommissionAdjustModal");
    let activeCommissionStaff = "all";
    let activeCommissionStart = "";
    let activeCommissionEnd = "";
    const formatCommissionMoney = (value) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
    const parseCommissionNumber = (value) => {
        const normalized = String(value || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
        return Number.parseFloat(normalized) || 0;
    };
    const formatCommissionPercent = (value) => {
        const number = Number(value) || 0;
        return Number.isInteger(number) ? String(number) : String(number).replace(".", ",");
    };
    const commissionRangeLabel = () => {
        if (!activeCommissionStart || !activeCommissionEnd) return "-";
        const start = new Date(`${activeCommissionStart}T00:00:00`);
        const end = new Date(`${activeCommissionEnd}T00:00:00`);
        const startLabel = start.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        const endLabel = end.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
        return `${startLabel} - ${endLabel}`;
    };
    const syncAdjustControl = (container) => {
        if (!container) return;
        const input = container.querySelector(".js-commission-adjust-input-value");
        const mode = container.dataset.mode || "amount";
        const amount = parseCommissionNumber(container.dataset.amount || 0);
        const percent = parseCommissionNumber(container.dataset.percent || 0);
        container.querySelectorAll("[data-commission-adjust-type]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.commissionAdjustType === mode);
        });
        if (input) {
            input.value = mode === "amount" ? `Rp ${formatCommissionMoney(amount)}` : formatCommissionPercent(percent);
        }
    };
    const commitAdjustControlValue = (container) => {
        if (!container) return;
        const input = container.querySelector(".js-commission-adjust-input-value");
        const mode = container.dataset.mode || "amount";
        const parsed = parseCommissionNumber(input?.value || 0);
        if (mode === "amount") {
            container.dataset.amount = String(parsed);
        } else {
            container.dataset.percent = String(parsed);
        }
        syncAdjustControl(container);
    };
    const applyCommissionRowDisplay = (row, amount, percent, mode) => {
        row.dataset.commissionAmount = String(amount);
        row.dataset.commissionPercent = String(percent);
        row.dataset.commissionMode = mode;
        const amountCell = row.querySelector("[data-cell-commission-amount]");
        const percentCell = row.querySelector("[data-cell-commission-percent]");
        if (amountCell) amountCell.textContent = formatCommissionMoney(amount);
        if (percentCell) percentCell.textContent = `${formatCommissionPercent(percent)}%`;
    };
    const updateCommissionStaffRow = (row, nextName) => {
        if (!row || !nextName) return;
        row.dataset.commissionStaffName = nextName;
        const personButton = row.querySelector("[data-commission-edit-staff]");
        const personLabel = row.querySelector("[data-commission-person-label]");
        const actionButton = row.querySelector("[data-commission-action]");
        if (personButton) {
            personButton.dataset.commissionEditStaff = nextName;
        }
        if (personLabel) {
            personLabel.textContent = nextName;
        }
        if (actionButton) {
            actionButton.setAttribute("aria-label", `Edit komisi ${nextName}`);
        }
    };
    const commissionStaffDrawerEl = document.getElementById("staffCommissionStaffDrawer");
    if (commissionStaffDrawerEl) {
        const drawerSearch = commissionStaffDrawerEl.querySelector(".js-commission-staff-drawer-search");
        const drawerOptions = Array.from(commissionStaffDrawerEl.querySelectorAll("[data-commission-staff-option]"));
        const drawerEmpty = commissionStaffDrawerEl.querySelector(".staff-commission-staff-drawer__empty");
        const drawerSave = commissionStaffDrawerEl.querySelector(".js-commission-staff-drawer-save");
        const drawerState = {
            activeRow: null,
            selectedName: "",
        };
        const syncDrawerOptions = () => {
            const query = text(drawerSearch?.value);
            let visibleCount = 0;
            drawerOptions.forEach((option) => {
                const optionName = option.dataset.commissionStaffOption || "";
                const matchesQuery = !query || text(optionName).includes(query);
                option.hidden = !matchesQuery;
                option.classList.toggle("is-active", optionName === drawerState.selectedName);
                if (matchesQuery) visibleCount += 1;
            });
            if (drawerEmpty) drawerEmpty.hidden = visibleCount > 0;
            if (drawerSave) drawerSave.disabled = !drawerState.selectedName;
        };
        const closeCommissionStaffDrawer = () => {
            commissionStaffDrawerEl.classList.remove("is-open");
            commissionStaffDrawerEl.setAttribute("aria-hidden", "true");
            window.setTimeout(() => {
                if (!commissionStaffDrawerEl.classList.contains("is-open")) {
                    commissionStaffDrawerEl.hidden = true;
                }
            }, 180);
        };
        const openCommissionStaffDrawer = (row) => {
            drawerState.activeRow = row;
            drawerState.selectedName = row?.dataset.commissionStaffName || "";
            if (drawerSearch) drawerSearch.value = "";
            syncDrawerOptions();
            commissionStaffDrawerEl.hidden = false;
            commissionStaffDrawerEl.setAttribute("aria-hidden", "false");
            window.requestAnimationFrame(() => {
                commissionStaffDrawerEl.classList.add("is-open");
            });
            drawerSearch?.focus();
        };
        shell.querySelectorAll("[data-commission-edit-staff]").forEach((button) => {
            button.addEventListener("click", () => {
                const row = button.closest("[data-commission-row]");
                if (row) openCommissionStaffDrawer(row);
            });
        });
        drawerOptions.forEach((option) => {
            option.addEventListener("click", () => {
                drawerState.selectedName = option.dataset.commissionStaffOption || "";
                syncDrawerOptions();
            });
        });
        drawerSearch?.addEventListener("input", syncDrawerOptions);
        commissionStaffDrawerEl.querySelectorAll(".js-commission-staff-drawer-close").forEach((button) => {
            button.addEventListener("click", closeCommissionStaffDrawer);
        });
        drawerSave?.addEventListener("click", () => {
            if (!drawerState.activeRow || !drawerState.selectedName) return;
            updateCommissionStaffRow(drawerState.activeRow, drawerState.selectedName);
            applyCommissionFilter();
            closeCommissionStaffDrawer();
        });
    }
    const applyCommissionFilter = () => {
        const query = text(commissionSearch?.value);
        let visibleCount = 0;
        commissionRows.forEach((row) => {
            const matchesQuery = !query || text(row.textContent).includes(query);
            const matchesStaff = activeCommissionStaff === "all" || text(row.dataset.commissionStaffName || "").includes(text(activeCommissionStaff));
            const rowDate = row.dataset.commissionDate || "";
            const matchesStart = !activeCommissionStart || rowDate >= activeCommissionStart;
            const matchesEnd = !activeCommissionEnd || rowDate <= activeCommissionEnd;
            row.hidden = !matchesQuery || !matchesStaff || !matchesStart || !matchesEnd;
            if (!row.hidden) visibleCount += 1;
        });
        if (commissionEmpty) commissionEmpty.parentElement.hidden = visibleCount > 0;
    };
    commissionStaffMenu?.addEventListener("click", (event) => {
        const item = event.target instanceof HTMLElement ? event.target.closest("[data-commission-staff]") : null;
        if (!item) return;
        activeCommissionStaff = item.dataset.commissionStaff || "all";
        setButtonText(commissionStaff, activeCommissionStaff === "all" ? "Semua Staf" : activeCommissionStaff);
        commissionStaffMenu.querySelectorAll("[data-commission-staff]").forEach((button) => {
            button.classList.toggle("is-active", button === item);
        });
        applyCommissionFilter();
    });
    commissionSearch?.addEventListener("input", applyCommissionFilter);

    if (commissionAdjustModalEl) {
        const commissionAdjustModal = typeof bootstrap !== "undefined" ? bootstrap.Modal.getOrCreateInstance(commissionAdjustModalEl) : null;
        const mainName = commissionAdjustModalEl.querySelector(".js-commission-adjust-name");
        const mainItem = commissionAdjustModalEl.querySelector(".js-commission-adjust-item");
        const mainInvoice = commissionAdjustModalEl.querySelector(".js-commission-adjust-invoice");
        const mainSale = commissionAdjustModalEl.querySelector(".js-commission-adjust-sale");
        const mainControl = commissionAdjustModalEl.querySelector(".js-commission-adjust-main");
        const invoiceLabel = commissionAdjustModalEl.querySelector(".js-commission-adjust-invoice-label");
        const invoiceCount = commissionAdjustModalEl.querySelector(".js-commission-adjust-invoice-count");
        const rangeLabel = commissionAdjustModalEl.querySelector(".js-commission-adjust-range-label");
        const rangeCount = commissionAdjustModalEl.querySelector(".js-commission-adjust-range-count");
        const saveAdjust = commissionAdjustModalEl.querySelector(".js-commission-adjust-save");
        const state = {
            activeRow: null,
            invoiceRows: [],
            rangeRows: [],
        };
        const renderAdjustEntry = (row) => `
            <div class="staff-commission-adjust-row" data-commission-adjust-row-id="${row.dataset.commissionId || ""}">
                <div class="staff-commission-adjust-row__meta">
                    <div class="staff-commission-adjust__avatar staff-commission-adjust__avatar--small"><i class="bi bi-person"></i></div>
                    <div class="staff-commission-adjust-row__copy">
                        <strong>${row.dataset.commissionStaffName || "Staf"}</strong>
                        <span>${row.dataset.commissionInvoiceNo || "-"}</span>
                    </div>
                </div>
                <div class="staff-commission-adjust-row__item">
                    <strong>${row.dataset.commissionItemName || "-"}</strong>
                    <span>Rp ${formatCommissionMoney(row.dataset.commissionSaleValue || 0)}</span>
                </div>
                <div class="staff-commission-adjust-input" data-mode="${row.dataset.commissionMode || "amount"}" data-amount="${row.dataset.commissionAmount || 0}" data-percent="${row.dataset.commissionPercent || 0}">
                    <input class="js-commission-adjust-input-value" type="text" inputmode="decimal">
                    <button type="button" data-commission-adjust-type="amount">Rp</button>
                    <button type="button" data-commission-adjust-type="percent">%</button>
                </div>
            </div>
        `;
        const renderAdjustGroups = () => {
            commissionAdjustModalEl.querySelectorAll("[data-group-list]").forEach((list) => {
                const rows = list.dataset.groupList === "invoice" ? state.invoiceRows : state.rangeRows;
                list.innerHTML = rows.map(renderAdjustEntry).join("");
                list.querySelectorAll(".staff-commission-adjust-input").forEach(syncAdjustControl);
            });
            if (invoiceCount) invoiceCount.textContent = `${state.invoiceRows.length} staff lain`;
            if (rangeCount) rangeCount.textContent = `${state.rangeRows.length} faktur lain`;
            if (rangeLabel) rangeLabel.textContent = commissionRangeLabel();
        };
        const openCommissionAdjustModal = (row) => {
            state.activeRow = row;
            state.invoiceRows = commissionRows.filter((candidate) => candidate !== row && candidate.dataset.commissionInvoiceNo === row.dataset.commissionInvoiceNo);
            state.rangeRows = commissionRows.filter((candidate) => candidate !== row && candidate.dataset.commissionInvoiceNo !== row.dataset.commissionInvoiceNo && (!activeCommissionStart || candidate.dataset.commissionDate >= activeCommissionStart) && (!activeCommissionEnd || candidate.dataset.commissionDate <= activeCommissionEnd));
            if (mainName) mainName.textContent = row.dataset.commissionStaffName || "Staf";
            if (mainItem) mainItem.textContent = row.dataset.commissionItemName || "Layanan";
            if (mainInvoice) mainInvoice.textContent = row.dataset.commissionInvoiceNo || "-";
            if (mainSale) mainSale.textContent = `Rp ${formatCommissionMoney(row.dataset.commissionSaleValue || 0)}`;
            if (invoiceLabel) invoiceLabel.textContent = row.dataset.commissionInvoiceNo || "-";
            if (mainControl) {
                mainControl.dataset.mode = row.dataset.commissionMode || "amount";
                mainControl.dataset.amount = row.dataset.commissionAmount || "0";
                mainControl.dataset.percent = row.dataset.commissionPercent || "0";
                syncAdjustControl(mainControl);
            }
            commissionAdjustModalEl.querySelectorAll(".js-commission-adjust-toggle").forEach((button) => {
                button.classList.remove("is-open");
            });
            commissionAdjustModalEl.querySelectorAll("[data-group-list]").forEach((list) => {
                list.hidden = true;
            });
            renderAdjustGroups();
            commissionAdjustModal?.show();
        };
        shell.querySelectorAll("[data-commission-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const row = button.closest("[data-commission-row]");
                if (row) openCommissionAdjustModal(row);
            });
        });
        commissionAdjustModalEl.addEventListener("click", (event) => {
            const typeButton = event.target instanceof HTMLElement ? event.target.closest("[data-commission-adjust-type]") : null;
            if (typeButton) {
                const container = typeButton.closest(".staff-commission-adjust-input");
                if (container) {
                    commitAdjustControlValue(container);
                    container.dataset.mode = typeButton.dataset.commissionAdjustType || "amount";
                    syncAdjustControl(container);
                }
                return;
            }
            const toggle = event.target instanceof HTMLElement ? event.target.closest(".js-commission-adjust-toggle") : null;
            if (toggle) {
                const group = toggle.dataset.group || "invoice";
                const list = commissionAdjustModalEl.querySelector(`[data-group-list="${group}"]`);
                if (list) {
                    const nextHidden = !list.hidden;
                    list.hidden = nextHidden;
                    toggle.classList.toggle("is-open", !nextHidden);
                }
            }
        });
        commissionAdjustModalEl.addEventListener("blur", (event) => {
            const input = event.target instanceof HTMLElement ? event.target.closest(".js-commission-adjust-input-value") : null;
            if (!input) return;
            commitAdjustControlValue(input.closest(".staff-commission-adjust-input"));
        }, true);
        saveAdjust?.addEventListener("click", () => {
            const allControls = [mainControl, ...Array.from(commissionAdjustModalEl.querySelectorAll("[data-group-list] .staff-commission-adjust-input"))];
            allControls.forEach(commitAdjustControlValue);
            if (state.activeRow && mainControl) {
                applyCommissionRowDisplay(
                    state.activeRow,
                    parseCommissionNumber(mainControl.dataset.amount || 0),
                    parseCommissionNumber(mainControl.dataset.percent || 0),
                    mainControl.dataset.mode || "amount",
                );
            }
            commissionAdjustModalEl.querySelectorAll("[data-commission-adjust-row-id]").forEach((entry) => {
                const rowId = entry.dataset.commissionAdjustRowId || "";
                const sourceRow = commissionRows.find((row) => row.dataset.commissionId === rowId);
                const control = entry.querySelector(".staff-commission-adjust-input");
                if (!sourceRow || !control) return;
                applyCommissionRowDisplay(
                    sourceRow,
                    parseCommissionNumber(control.dataset.amount || 0),
                    parseCommissionNumber(control.dataset.percent || 0),
                    control.dataset.mode || "amount",
                );
            });
            commissionAdjustModal?.hide();
        });
    }

    const commissionDateModal = document.getElementById("staffCommissionDateFilterModal");
    if (commissionDateModal) {
        const startInput = commissionDateModal.querySelector(".js-staff-commission-start");
        const endInput = commissionDateModal.querySelector(".js-staff-commission-end");
        const rangeInput = commissionDateModal.querySelector(".js-staff-commission-date-range");
        const resetBtn = commissionDateModal.querySelector(".js-staff-commission-date-reset");
        const applyBtn = commissionDateModal.querySelector(".js-staff-commission-date-apply");
        const presetButtons = Array.from(commissionDateModal.querySelectorAll(".js-staff-commission-date-preset"));
        const commissionDateModalInstance = typeof bootstrap !== "undefined" ? bootstrap.Modal.getOrCreateInstance(commissionDateModal) : null;
        let activePreset = "7d";
        let fp = null;
        const today = new Date();
        const displayDate = (value) => {
            const date = new Date(`${value}T00:00:00`);
            return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
        };
        const setRange = (start, end) => {
            if (startInput) startInput.value = start || "";
            if (endInput) endInput.value = end || "";
            if (fp) {
                fp.setDate([start, end].filter(Boolean), false, "Y-m-d");
            }
        };
        const syncPresetButtons = () => {
            presetButtons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.preset === activePreset);
            });
        };
        const applyRange = ({ closeModal = true } = {}) => {
            const start = startInput?.value || "";
            const end = endInput?.value || "";
            const presetLabel = activePreset === "today" ? "Hari ini"
                : activePreset === "yesterday" ? "Kemarin"
                    : activePreset === "this_month" ? "Bulan ini"
                        : activePreset === "30d" ? "30 hari sebelumnya"
                            : activePreset === "last_month" ? "Bulan kemarin"
                                : activePreset === "this_year" ? "Tahun ini"
                                    : activePreset === "last_year" ? "Tahun kemarin"
                                        : "7 hari sebelumnya";
            if (commissionRange) {
                commissionRange.textContent = start && end ? `${presetLabel}, ${displayDate(start)} - ${displayDate(end)}` : presetLabel;
            }
            activeCommissionStart = start;
            activeCommissionEnd = end;
            applyCommissionFilter();
            if (closeModal) {
                commissionDateModalInstance?.hide();
            }
        };
        if (rangeInput && typeof flatpickr !== "undefined") {
            fp = flatpickr(rangeInput, {
                mode: "range",
                inline: true,
                dateFormat: "Y-m-d",
                defaultDate: [startInput?.value, endInput?.value].filter(Boolean),
                onChange: (selectedDates) => {
                    const [start, end] = selectedDates;
                    if (startInput) startInput.value = start ? formatYmd(start) : "";
                    if (endInput) endInput.value = end ? formatYmd(end) : "";
                    if (start || end) {
                        activePreset = "";
                        syncPresetButtons();
                    }
                },
            });
        }
        presetButtons.forEach((button) => {
            button.addEventListener("click", () => {
                activePreset = button.dataset.preset || "7d";
                const start = new Date(today);
                const end = new Date(today);
                if (activePreset === "yesterday") {
                    start.setDate(today.getDate() - 1);
                    end.setDate(today.getDate() - 1);
                } else if (activePreset === "7d") {
                    start.setDate(today.getDate() - 6);
                } else if (activePreset === "30d") {
                    start.setDate(today.getDate() - 29);
                } else if (activePreset === "this_month") {
                    start.setDate(1);
                } else if (activePreset === "last_month") {
                    start.setMonth(today.getMonth() - 1, 1);
                    end.setMonth(today.getMonth(), 0);
                } else if (activePreset === "this_year") {
                    start.setMonth(0, 1);
                } else if (activePreset === "last_year") {
                    start.setFullYear(today.getFullYear() - 1, 0, 1);
                    end.setFullYear(today.getFullYear() - 1, 11, 31);
                }
                setRange(formatYmd(start), formatYmd(end));
                syncPresetButtons();
                applyRange();
            });
        });
        startInput?.addEventListener("change", () => {
            activePreset = "";
            syncPresetButtons();
            setRange(startInput.value, endInput?.value || "");
        });
        endInput?.addEventListener("change", () => {
            activePreset = "";
            syncPresetButtons();
            setRange(startInput?.value || "", endInput.value);
        });
        resetBtn?.addEventListener("click", () => {
            activePreset = "7d";
            const start = new Date(today);
            start.setDate(today.getDate() - 6);
            setRange(formatYmd(start), formatYmd(today));
            syncPresetButtons();
        });
        activeCommissionStart = startInput?.value || "";
        activeCommissionEnd = endInput?.value || "";
        syncPresetButtons();
        applyBtn?.addEventListener("click", () => applyRange());
    }
    applyCommissionFilter();
}

function initStaffWorkModal(shell) {
    const modalEl = document.getElementById("staffWorkModal");
    if (!modalEl) {
        return;
    }

    const modal = typeof bootstrap !== "undefined" ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
    const staffNameEl = modalEl.querySelector(".js-staff-work-name");
    const dateEl = modalEl.querySelector(".js-staff-work-date");
    const shiftsEl = modalEl.querySelector(".js-staff-work-shifts");
    const addShiftBtn = modalEl.querySelector(".js-staff-work-add-shift");
    const repeatButtons = Array.from(modalEl.querySelectorAll("[data-staff-repeat]"));
    const repeatEndButtons = Array.from(modalEl.querySelectorAll("[data-staff-repeat-end]"));
    const weeklyOptions = modalEl.querySelector(".js-staff-work-weekly-options");
    const repeatDateField = modalEl.querySelector(".js-staff-work-repeat-date-field");
    const repeatDateInput = modalEl.querySelector(".js-staff-work-repeat-date");
    const saveBtn = modalEl.querySelector(".js-staff-work-save");
    const deleteBtn = modalEl.querySelector(".js-staff-work-delete");
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const maxShifts = 3;
    const state = {
        targetCell: null,
        staffId: "",
        staffName: "",
        date: "",
        dayIndex: 0,
        repeat: "none",
        repeatEnd: "ongoing",
        repeatEndDate: "",
        shifts: [],
        isEditing: false,
    };

    let repeatPicker = null;
    let timePickerEl = null;
    let activeTimeInput = null;
    const pad = (value) => String(value).padStart(2, "0");
    const hourOptions = Array.from({ length: 24 }, (_, index) => pad(index));
    const minuteOptions = Array.from({ length: 12 }, (_, index) => pad(index * 5));
    const parseDate = (dateStr) => {
        const [year, month, day] = String(dateStr || "").split("-").map(Number);
        return new Date(year || 1970, (month || 1) - 1, day || 1);
    };
    const formatDate = (dateStr) => {
        const date = parseDate(dateStr);
        return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    };
    const isValidTime = (value) => {
        const match = String(value || "").match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
        return Boolean(match);
    };
    const timeToMinutes = (value) => {
        if (!isValidTime(value)) return null;
        const [hours, minutes] = value.split(":").map(Number);
        return (hours * 60) + minutes;
    };
    const minutesToTime = (total) => `${pad(Math.floor((total % 1440) / 60))}:${pad(total % 60)}`;
    const addMinutes = (value, minutes) => {
        const parsed = timeToMinutes(value);
        return parsed === null ? "" : minutesToTime(parsed + minutes);
    };
    const parseTimeParts = (value) => {
        if (!isValidTime(value)) {
            return { hour: "08", minute: "00" };
        }
        const [hour, minute] = value.split(":");
        const roundedMinute = pad(Math.round(Number(minute) / 5) * 5).slice(-2);
        return { hour: pad(hour), minute: minuteOptions.includes(roundedMinute) ? roundedMinute : "00" };
    };
    const addButtonHtml = '<button class="staff-schedule-add" type="button" aria-label="Tambah shift"><i class="bi bi-plus-lg"></i></button>';
    const normalizeShifts = (shifts) => {
        const normalized = Array.isArray(shifts) ? shifts
            .map((shift) => ({ start: shift?.start || "", end: shift?.end || "" }))
            .filter((shift) => shift.start || shift.end)
            .slice(0, maxShifts) : [];
        return normalized.length ? normalized : [{ start: "08:00", end: "17:00" }];
    };
    const readCellShifts = (cell) => {
        if (cell.dataset.workShifts) {
            try {
                return normalizeShifts(JSON.parse(cell.dataset.workShifts));
            } catch (_error) {
                return normalizeShifts([]);
            }
        }

        const visibleShifts = Array.from(cell.querySelectorAll(".staff-work-selected-hours span, .staff-schedule-hours"))
            .map((item) => {
                const [start = "", end = ""] = item.textContent.split("-").map((part) => part.trim());
                return { start, end };
            });
        return normalizeShifts(visibleShifts);
    };
    const renderCellHours = (cell, shifts) => {
        cell.classList.add("is-filled");
        cell.dataset.workShifts = JSON.stringify(normalizeShifts(shifts));
        cell.dataset.workRepeat = state.repeat;
        cell.dataset.workRepeatEnd = state.repeatEnd;
        cell.dataset.workRepeatEndDate = state.repeatEndDate;

        if (cell.classList.contains("staff-month-cell")) {
            cell.innerHTML = "";
            return;
        }

        const label = normalizeShifts(shifts)
            .map((shift) => `<span>${shift.start} - ${shift.end}</span>`)
            .join("");
        cell.innerHTML = `<div class="staff-work-selected-hours">${label}</div>`;
    };
    const clearCellHours = (cell) => {
        cell.classList.remove("is-filled");
        delete cell.dataset.workShifts;
        delete cell.dataset.workRepeat;
        delete cell.dataset.workRepeatEnd;
        delete cell.dataset.workRepeatEndDate;
        cell.innerHTML = addButtonHtml;
    };

    const ensureTimePicker = () => {
        if (timePickerEl) return timePickerEl;
        timePickerEl = document.createElement("div");
        timePickerEl.className = "staff-time-picker";
        timePickerEl.hidden = true;
        timePickerEl.innerHTML = `
            <div class="staff-time-picker__col">
                <div class="staff-time-picker__label">HH</div>
                <div class="staff-time-picker__list" data-time-hours></div>
            </div>
            <div class="staff-time-picker__col">
                <div class="staff-time-picker__label">mm</div>
                <div class="staff-time-picker__list" data-time-minutes></div>
            </div>
        `;
        modalEl.appendChild(timePickerEl);
        timePickerEl.addEventListener("click", (event) => {
            event.stopPropagation();
            const option = event.target instanceof HTMLElement ? event.target.closest("[data-time-part]") : null;
            if (!option || !activeTimeInput) return;

            const row = activeTimeInput.closest("[data-shift-index]");
            const index = Number(row?.getAttribute("data-shift-index"));
            const field = activeTimeInput.dataset.shiftField;
            if (Number.isNaN(index) || !field || !state.shifts[index]) return;

            const parts = parseTimeParts(activeTimeInput.value || state.shifts[index][field]);
            parts[option.dataset.timePart === "hour" ? "hour" : "minute"] = option.dataset.timeValue || "00";
            const nextValue = `${parts.hour}:${parts.minute}`;
            state.shifts[index][field] = nextValue;
            activeTimeInput.value = nextValue;
            syncSaveState();

            if (option.dataset.timePart === "minute") {
                closeTimePicker();
            } else {
                renderTimePicker(activeTimeInput);
            }
        });
        return timePickerEl;
    };

    const closeTimePicker = () => {
        if (timePickerEl) {
            timePickerEl.hidden = true;
        }
        activeTimeInput = null;
    };

    const positionTimePicker = (input) => {
        const picker = ensureTimePicker();
        const field = input.closest(".staff-work-input") || input;
        const rect = field.getBoundingClientRect();
        const width = Math.max(rect.width, 230);
        const height = Math.min(260, window.innerHeight - 24);
        const topBelow = rect.bottom + 6;
        const top = topBelow + height > window.innerHeight - 12 ? Math.max(12, rect.top - height - 6) : topBelow;
        const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);

        picker.style.width = `${width}px`;
        picker.style.maxHeight = `${height}px`;
        picker.style.left = `${left}px`;
        picker.style.top = `${top}px`;
    };

    const renderTimePicker = (input) => {
        const picker = ensureTimePicker();
        const parts = parseTimeParts(input.value);
        const renderOption = (part, value) => `
            <button class="staff-time-picker__option ${parts[part] === value ? "is-active" : ""}" type="button" data-time-part="${part}" data-time-value="${value}">
                ${value}
            </button>
        `;
        picker.querySelector("[data-time-hours]").innerHTML = hourOptions.map((value) => renderOption("hour", value)).join("");
        picker.querySelector("[data-time-minutes]").innerHTML = minuteOptions.map((value) => renderOption("minute", value)).join("");
        activeTimeInput = input;
        positionTimePicker(input);
        picker.hidden = false;
    };

    const setupRepeatPicker = () => {
        if (!repeatDateInput || typeof flatpickr === "undefined") {
            return;
        }

        if (!repeatPicker) {
            repeatPicker = flatpickr(repeatDateInput, {
                dateFormat: "Y-m-d",
                disableMobile: true,
                allowInput: false,
                onChange: (_dates, dateStr) => {
                    state.repeatEndDate = dateStr;
                    syncSaveState();
                },
                onOpen: (_dates, _str, instance) => {
                    instance.calendarContainer.classList.add("staff-work-repeat-date-calendar");
                },
            });
        }

        repeatPicker.set("minDate", state.date);
        repeatPicker.set("disable", [(date) => date.getDay() !== state.dayIndex]);
        repeatPicker.jumpToDate(parseDate(state.date));
        if (state.repeatEndDate) {
            repeatPicker.setDate(state.repeatEndDate, false, "Y-m-d");
        } else {
            repeatPicker.clear();
        }
    };

    const syncSegmented = () => {
        repeatButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.staffRepeat === state.repeat);
        });
        repeatEndButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.staffRepeatEnd === state.repeatEnd);
        });
        if (weeklyOptions) {
            weeklyOptions.hidden = state.repeat !== "weekly";
        }
        if (repeatDateField) {
            repeatDateField.hidden = state.repeat !== "weekly" || state.repeatEnd !== "specific";
        }
    };

    const syncSaveState = () => {
        const shiftsValid = state.shifts.every((shift) => isValidTime(shift.start) && isValidTime(shift.end));
        const repeatValid = state.repeat !== "weekly" || state.repeatEnd !== "specific" || Boolean(state.repeatEndDate);
        if (saveBtn) {
            saveBtn.disabled = !shiftsValid || !repeatValid;
        }
    };

    const renderShifts = () => {
        if (!shiftsEl) return;
        closeTimePicker();
        shiftsEl.innerHTML = state.shifts.map((shift, index) => `
            <div class="staff-work-shift" data-shift-index="${index}">
                ${index > 0 ? '<div class="staff-work-break-note">15 Menit waktu beristirahat</div>' : ''}
                <div class="staff-work-shift__grid">
                    <div class="staff-work-field">
                        <label>Shift Mulai</label>
                        <div class="staff-work-input">
                            <i class="bi bi-clock"></i>
                            <input type="text" inputmode="none" readonly placeholder="HH:mm" value="${shift.start}" data-time-picker data-shift-field="start" aria-haspopup="listbox">
                        </div>
                    </div>
                    <div class="staff-work-field">
                        <label>Shift Berakhir</label>
                        <div class="staff-work-input">
                            <i class="bi bi-clock"></i>
                            <input type="text" inputmode="none" readonly placeholder="HH:mm" value="${shift.end}" data-time-picker data-shift-field="end" aria-haspopup="listbox">
                        </div>
                    </div>
                </div>
                ${index > 0 ? '<button class="staff-work-remove-shift" type="button" data-remove-shift aria-label="Hapus shift"><i class="bi bi-x-lg"></i></button>' : ''}
            </div>
        `).join("");
        if (addShiftBtn) {
            addShiftBtn.disabled = state.shifts.length >= maxShifts;
            addShiftBtn.classList.toggle("is-disabled", state.shifts.length >= maxShifts);
        }
        syncSaveState();
    };

    const openWorkModal = (cell, isEditing = false) => {
        state.targetCell = cell;
        state.staffId = cell.dataset.staffId || "";
        state.staffName = cell.dataset.staffName || "Staf";
        state.date = cell.dataset.date || "";
        state.dayIndex = Number(cell.dataset.dayIndex || parseDate(state.date).getDay());
        state.isEditing = isEditing || cell.classList.contains("is-filled");
        state.repeat = cell.dataset.workRepeat || "none";
        state.repeatEnd = cell.dataset.workRepeatEnd || "ongoing";
        state.repeatEndDate = cell.dataset.workRepeatEndDate || "";
        state.shifts = state.isEditing ? readCellShifts(cell) : [{ start: "08:00", end: "17:00" }];

        if (staffNameEl) staffNameEl.textContent = state.staffName;
        if (dateEl) dateEl.textContent = cell.dataset.dayLabel || formatDate(state.date);
        if (repeatDateInput) repeatDateInput.value = state.repeatEndDate;
        if (deleteBtn) deleteBtn.hidden = !state.isEditing;
        syncSegmented();
        setupRepeatPicker();
        if (state.repeatEndDate && repeatPicker) {
            repeatPicker.setDate(state.repeatEndDate, false, "Y-m-d");
        }
        renderShifts();

        if (modal) {
            modal.show();
        } else {
            modalEl.classList.add("show");
            modalEl.style.display = "block";
        }
    };

    const selectedCells = () => {
        if (!state.targetCell) return [];
        if (state.repeat !== "weekly") {
            return [state.targetCell];
        }

        const endDate = state.repeatEnd === "specific" ? state.repeatEndDate : "";
        return Array.from(shell.querySelectorAll(`[data-staff-work-cell][data-staff-id="${state.staffId}"][data-day-index="${state.dayIndex}"]`))
            .filter((cell) => {
                const cellDate = cell.dataset.date || "";
                if (cellDate < state.date) return false;
                if (endDate && cellDate > endDate) return false;
                return true;
            });
    };

    const saveWorkHours = () => {
        selectedCells().forEach((cell) => {
            renderCellHours(cell, state.shifts);
        });
        modal?.hide();
    };

    const deleteWorkHours = () => {
        selectedCells().forEach(clearCellHours);
        modal?.hide();
    };

    shell.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const trigger = target.closest(".staff-schedule-add");
        const filledCell = target.closest("[data-staff-work-cell].is-filled");
        const cell = trigger?.closest("[data-staff-work-cell]") || filledCell;
        if (!cell) return;
        openWorkModal(cell, Boolean(filledCell && !trigger));
    });

    addShiftBtn?.addEventListener("click", () => {
        if (state.shifts.length >= maxShifts) {
            return;
        }
        const previous = state.shifts[state.shifts.length - 1];
        state.shifts.push({ start: addMinutes(previous?.end || "17:00", 15), end: "" });
        renderShifts();
    });

    shiftsEl?.addEventListener("input", (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;
        const row = input.closest("[data-shift-index]");
        const index = Number(row?.getAttribute("data-shift-index"));
        const field = input.dataset.shiftField;
        if (!Number.isNaN(index) && field && state.shifts[index]) {
            state.shifts[index][field] = input.value;
            syncSaveState();
        }
    });

    shiftsEl?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const timeInput = target.closest("[data-time-picker]") || target.closest(".staff-work-input")?.querySelector("[data-time-picker]");
        if (timeInput instanceof HTMLInputElement) {
            renderTimePicker(timeInput);
            return;
        }
        const remove = target.closest("[data-remove-shift]");
        if (!remove) return;
        const row = remove.closest("[data-shift-index]");
        const index = Number(row?.getAttribute("data-shift-index"));
        if (index > 0) {
            state.shifts.splice(index, 1);
            renderShifts();
        }
    });

    repeatButtons.forEach((button) => {
        button.addEventListener("click", () => {
            state.repeat = button.dataset.staffRepeat || "none";
            syncSegmented();
            syncSaveState();
        });
    });

    repeatEndButtons.forEach((button) => {
        button.addEventListener("click", () => {
            state.repeatEnd = button.dataset.staffRepeatEnd || "ongoing";
            if (state.repeatEnd === "specific") {
                setupRepeatPicker();
            }
            syncSegmented();
            syncSaveState();
        });
    });

    saveBtn?.addEventListener("click", saveWorkHours);
    deleteBtn?.addEventListener("click", deleteWorkHours);
    modalEl.addEventListener("hidden.bs.modal", closeTimePicker);
    document.addEventListener("click", (event) => {
        if (!timePickerEl || timePickerEl.hidden) return;
        const target = event.target;
        if (target instanceof Node && (timePickerEl.contains(target) || activeTimeInput?.closest(".staff-work-input")?.contains(target))) {
            return;
        }
        closeTimePicker();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeTimePicker();
        }
    });
}

function initStaffDatePickers({ shell, weekRange, monthRange, weekPicker }) {
    // Week picker (auto-week range like 06 Apr - 12 Apr 2025)
    if (weekPicker && typeof flatpickr !== "undefined") {
        const label = weekRange?.querySelector("span");
        const icon = label?.querySelector("i")?.outerHTML || "";
        const fmt = (d) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        const fmtYear = (d) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
        const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const sundayOf = (d) => {
            const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            copy.setDate(copy.getDate() - copy.getDay());
            return copy;
        };
        const addDays = (d, n) => {
            const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            copy.setDate(copy.getDate() + n);
            return copy;
        };
        const parseLocalDate = (value) => {
            const [year, month, day] = String(value || "").split("-").map(Number);
            return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
        };
        const weekHead = shell.querySelector('[data-staff-mode-panel="week"] .staff-schedule-days-grid--week');
        const weekRows = Array.from(shell.querySelectorAll('[data-staff-mode-panel="week"] .staff-week-days-row'));
        const dayNamesId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        const dayNamesEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const firstWeekCell = shell.querySelector('[data-staff-mode-panel="week"] [data-staff-work-cell]');
        let currentWeekStart = sundayOf(firstWeekCell?.dataset.date ? parseLocalDate(firstWeekCell.dataset.date) : new Date());
        const attr = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        }[char]));

        const renderWeekSchedule = (start) => {
            currentWeekStart = sundayOf(start);
            const todayIso = iso(new Date());
            const days = Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index));
            if (label) {
                label.innerHTML = `${icon} ${fmt(days[0])} - ${fmtYear(days[6])}`;
            }
            if (weekHead) {
                weekHead.innerHTML = days.map((day) => `
                    <div class="staff-schedule-day${iso(day) === todayIso ? " is-today" : ""}">
                        <strong>${dayNamesId[day.getDay()]}</strong>
                        <span>${day.getDate()} ${day.toLocaleDateString("id-ID", { month: "short" })} ${String(day.getFullYear()).slice(-2)}</span>
                    </div>
                `).join("");
            }
            weekRows.forEach((row) => {
                const staffId = row.dataset.staffId || "";
                const staffName = row.dataset.staffName || "Staf";
                row.innerHTML = days.map((day) => {
                    const date = iso(day);
                    const labelText = `${dayNamesEn[day.getDay()]}, ${day.getDate()} ${day.toLocaleDateString("en-US", { month: "short" })} ${day.getFullYear()}`;
                    return `
                        <div class="staff-schedule-cell" data-staff-work-cell data-staff-id="${attr(staffId)}" data-staff-name="${attr(staffName)}" data-date="${attr(date)}" data-day-index="${day.getDay()}" data-day-label="${attr(labelText)}">
                            ${date === todayIso ? '<span class="staff-schedule-hours">00:00 - 23:55</span>' : '<button class="staff-schedule-add" type="button" aria-label="Tambah shift"><i class="bi bi-plus-lg"></i></button>'}
                        </div>
                    `;
                }).join("");
            });
        };

        let suppress = false;
        const fp = flatpickr(weekPicker, {
            mode: "range",
            dateFormat: "Y-m-d",
            disableMobile: true,
            animate: false,
            onChange: (selectedDates) => {
                if (suppress) return;
                if (!selectedDates || !selectedDates.length) return;
                const start = sundayOf(selectedDates[0]);
                const end = addDays(start, 6);
                // Force highlight of the whole week after first click.
                suppress = true;
                fp.setDate([start, end], false);
                suppress = false;
                renderWeekSchedule(start);
            },
            onReady: (_dates, _str, instance) => {
                const clearHover = () => {
                    instance.daysContainer
                        ?.querySelectorAll(".flatpickr-day.is-hover-week")
                        .forEach((el) => el.classList.remove("is-hover-week"));
                };
                let hoverWeekKey = "";
                const markHoverWeek = (dateObj) => {
                    if (!dateObj) return;
                    const nextKey = dateObj.toDateString();
                    if (nextKey === hoverWeekKey) return;
                    hoverWeekKey = nextKey;
                    clearHover();
                    const start = sundayOf(dateObj);
                    const end = addDays(start, 6);
                    const days = instance.daysContainer?.querySelectorAll(".flatpickr-day") || [];
                    days.forEach((el) => {
                        const d = el.dateObj;
                        if (!d) return;
                        if (d >= start && d <= end) {
                            el.classList.add("is-hover-week");
                        }
                    });
                };

                instance.calendarContainer?.addEventListener("mouseleave", () => {
                    hoverWeekKey = "";
                    clearHover();
                });
                instance.daysContainer?.addEventListener("mouseover", (ev) => {
                    const t = ev.target;
                    if (!(t instanceof HTMLElement)) return;
                    const day = t.classList.contains("flatpickr-day") ? t : t.closest(".flatpickr-day");
                    if (!day || !day.dateObj) return;
                    markHoverWeek(day.dateObj);
                });
            },
        });

        // Initialize with current label if possible (no-op if user doesn't open picker)
        if (weekRange) {
            weekRange.addEventListener("click", (event) => {
                const target = event.target;
                if (target instanceof HTMLElement && target.classList.contains("bi-chevron-left")) {
                    renderWeekSchedule(addDays(currentWeekStart, -7));
                    return;
                }
                if (target instanceof HTMLElement && target.classList.contains("bi-chevron-right")) {
                    renderWeekSchedule(addDays(currentWeekStart, 7));
                    return;
                }
                fp.open();
            });
        }
    }

    // Month picker (custom, lightweight) matching the "year + month grid" UI.
    if (monthRange) {
        const ensurePopover = () => {
            let pop = document.getElementById("staffMonthPopover");
            if (pop) return pop;

            pop = document.createElement("div");
            pop.id = "staffMonthPopover";
            pop.className = "staff-month-popover";
            pop.innerHTML = `
                <div class="staff-month-popover__head">
                    <button type="button" class="staff-month-popover__nav" data-year-prev aria-label="Tahun sebelumnya"><i class="bi bi-chevron-double-left"></i></button>
                    <div class="staff-month-popover__title"><span class="js-staff-month-year"></span></div>
                    <button type="button" class="staff-month-popover__nav" data-year-next aria-label="Tahun berikutnya"><i class="bi bi-chevron-double-right"></i></button>
                </div>
                <div class="staff-month-popover__grid" data-month-grid></div>
            `;
            document.body.appendChild(pop);
            return pop;
        };

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = monthRange.querySelector("span");
        const icon = label?.querySelector("i")?.outerHTML || "";
        const state = { open: false, year: new Date().getFullYear(), month: new Date().getMonth() };
        const monthPanel = shell.querySelector('[data-staff-mode-panel="month"]');
        const monthHeadGrid = monthPanel?.querySelector(".staff-month-right__head .staff-schedule-days-grid--month");
        const getMonthRows = () => Array.from(monthPanel?.querySelectorAll(".staff-month-days-row") || []);
        const highlightedDays = (daysInMonth) => [2, 9, 16, 23, 30].filter((day) => day <= daysInMonth);
        const resolveMonthCellWidth = () => {
            const template = monthHeadGrid?.style?.gridTemplateColumns || "";
            const match = template.match(/(\d+(?:\.\d+)?)px/);
            return match ? Number(match[1]) : 36;
        };

        const renderMonthSchedule = () => {
            if (!monthHeadGrid || !monthPanel) return;

            const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
            const monthCellWidth = resolveMonthCellWidth();
            const templateColumns = `repeat(${daysInMonth}, ${monthCellWidth}px)`;
            const days = Array.from({ length: daysInMonth }, (_, idx) => idx + 1);
            const today = new Date();
            const todayMatch = today.getFullYear() === state.year && today.getMonth() === state.month ? today.getDate() : -1;
            const filledDays = highlightedDays(daysInMonth);
            const attr = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;",
            }[char]));
            monthHeadGrid.style.gridTemplateColumns = templateColumns;

            monthHeadGrid.innerHTML = days
                .map((day) => {
                    const active = day === todayMatch ? ' is-today' : '';
                    return `<div class="staff-schedule-month-day${active}"><strong>${day}</strong></div>`;
                })
                .join("");

            getMonthRows().forEach((row) => {
                row.style.gridTemplateColumns = templateColumns;
                const staffId = row.dataset.staffId || "";
                const staffName = row.dataset.staffName || "Staf";
                row.innerHTML = days
                    .map((day) => {
                        const filled = filledDays.includes(day) ? " is-filled" : "";
                        const date = new Date(state.year, state.month, day);
                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                        const dayLabel = `${date.toLocaleDateString("en-US", { weekday: "long" })}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                        return `<div class="staff-month-cell${filled}" data-staff-work-cell data-staff-id="${attr(staffId)}" data-staff-name="${attr(staffName)}" data-date="${attr(dateStr)}" data-day-index="${date.getDay()}" data-day-label="${attr(dayLabel)}"><button class="staff-schedule-add" type="button" aria-label="Tambah shift"><i class="bi bi-plus-lg"></i></button></div>`;
                    })
                    .join("");
            });
        };

        const render = (pop) => {
            const yearEl = pop.querySelector(".js-staff-month-year");
            const grid = pop.querySelector("[data-month-grid]");
            if (yearEl) yearEl.textContent = String(state.year);
            if (!grid) return;
            grid.innerHTML = monthNames
                .map((name, idx) => {
                    const active = idx === state.month ? " is-active" : "";
                    return `<button type="button" class="staff-month-popover__month${active}" data-month="${idx}">${name}</button>`;
                })
                .join("");
        };

        const place = (pop) => {
            const rect = monthRange.getBoundingClientRect();
            const pad = 10;
            const popWidth = pop.offsetWidth || 430;
            const popHeight = pop.offsetHeight || 360;
            const maxLeft = window.innerWidth - popWidth - pad;
            const left = Math.max(pad, Math.min(rect.left, maxLeft));

            let top = rect.bottom + 10;
            const maxTop = window.innerHeight - popHeight - pad;
            if (top > maxTop) {
                top = rect.top - popHeight - 8;
            }

            pop.style.left = `${left}px`;
            pop.style.top = `${Math.max(pad, top)}px`;
        };

        const open = () => {
            const pop = ensurePopover();
            render(pop);
            pop.classList.add("is-open");
            place(pop);
            state.open = true;
        };

        const close = () => {
            const pop = document.getElementById("staffMonthPopover");
            pop?.classList.remove("is-open");
            state.open = false;
        };

        const applyLabel = () => {
            if (!label) return;
            label.innerHTML = `${icon} ${monthNames[state.month]} ${state.year}`;
            renderMonthSchedule();
        };
        const shiftMonth = (delta) => {
            const next = new Date(state.year, state.month + delta, 1);
            state.year = next.getFullYear();
            state.month = next.getMonth();
            applyLabel();
            const pop = document.getElementById("staffMonthPopover");
            if (pop) render(pop);
        };

        monthRange.addEventListener("click", (event) => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest(".staff-range-input")) {
                return;
            }
            if (target instanceof HTMLElement && target.classList.contains("bi-chevron-left")) {
                shiftMonth(-1);
                return;
            }
            if (target instanceof HTMLElement && target.classList.contains("bi-chevron-right")) {
                shiftMonth(1);
                return;
            }
            state.open ? close() : open();
        });

        document.addEventListener("click", (event) => {
            const pop = document.getElementById("staffMonthPopover");
            if (!state.open || !pop) return;
            const t = event.target;
            if (!(t instanceof Node)) return;
            if (monthRange.contains(t) || pop.contains(t)) return;
            close();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") close();
        });

        const pop = ensurePopover();
        pop.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.matches("[data-year-prev]")) {
                state.year -= 1;
                renderMonthSchedule();
                render(pop);
                return;
            }
            if (target.matches("[data-year-next]")) {
                state.year += 1;
                renderMonthSchedule();
                render(pop);
                return;
            }
            const monthBtn = target.closest("[data-month]");
            if (monthBtn) {
                const month = Number(monthBtn.getAttribute("data-month"));
                if (!Number.isNaN(month)) {
                    state.month = month;
                    applyLabel();
                    render(pop);
                    close();
                }
            }
        });

        // initial label from server render is fine; keep state in sync to current month.
        applyLabel();
    }
}

function initServicesPage() {
    const shell = document.querySelector(".js-services-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".services-tab"));
    const panels = Array.from(shell.querySelectorAll(".services-panel"));
    const fab = shell.querySelector(".js-services-fab");
    const pickerTitle = document.querySelector(".js-service-picker-title");
    const menuToggles = Array.from(shell.querySelectorAll("[data-services-menu-toggle]"));
    const fabConfig = {
        groups: {
            target: "#serviceGroupModal",
            label: "Tambah grup layanan",
            title: "Tambah Grup Layanan",
        },
        services: {
            target: "#serviceGroupPickerModal",
            label: "Tambah layanan",
            title: "Pilih Grup Layanan untuk Layanan Baru",
        },
        packages: {
            target: "#serviceGroupPickerModal",
            label: "Tambah paket layanan",
            title: "Pilih Grup Layanan untuk Paket Baru",
        },
    };

    const closeMenus = () => {
        shell.querySelectorAll("[data-services-menu].is-open").forEach((menu) => {
            menu.classList.remove("is-open");
        });
    };

    const applyTab = (tabName) => {
        tabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.servicesTab === tabName);
        });

        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.servicesPanel === tabName);
        });

        if (!fab) {
            return;
        }

        const config = fabConfig[tabName] || fabConfig.groups;
        fab.setAttribute("data-bs-target", config.target);
        fab.setAttribute("aria-label", config.label);

        if (pickerTitle && config.target === "#serviceGroupPickerModal") {
            pickerTitle.textContent = config.title;
        }
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            closeMenus();
            applyTab(tab.dataset.servicesTab);
        });
    });

    menuToggles.forEach((toggle) => {
        toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            const wrap = toggle.closest(".services-menu-wrap");
            const menu = wrap?.querySelector("[data-services-menu]");
            const isOpen = menu?.classList.contains("is-open");
            closeMenus();
            if (menu && !isOpen) {
                menu.classList.add("is-open");
            }
        });
    });

    document.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof Node && shell.contains(target) && target.closest(".services-menu-wrap")) {
            return;
        }
        closeMenus();
    });

    applyTab("groups");
}

function initVouchersPage() {
    const shell = document.querySelector(".js-vouchers-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".js-vouchers-tab"));
    const panels = Array.from(shell.querySelectorAll(".js-vouchers-panel"));
    const fab = shell.querySelector(".js-vouchers-fab");
    const voucherSearch = shell.querySelector(".js-vouchers-search");
    const discountSearch = shell.querySelector(".js-vouchers-discount-search");
    const voucherTypeFilters = Array.from(shell.querySelectorAll(".js-voucher-type-filter"));
    const voucherTableBody = shell.querySelector(".js-voucher-table-body");
    const voucherTotalLabel = shell.querySelector(".inventory-table__footer > span");
    const discountList = shell.querySelector(".js-voucher-discount-list");
    const voucherFabMenu = shell.querySelector(".js-voucher-fab-menu");
    const voucherFabClose = shell.querySelector(".js-voucher-fab-close");
    const voucherCreateTriggers = Array.from(shell.querySelectorAll(".js-voucher-create-trigger"));
    const voucherPreviewToggles = Array.from(document.querySelectorAll(".js-voucher-preview-toggle"));
    const voucherServiceModalEl = document.getElementById("voucherServiceModal");
    const voucherServiceModal = voucherServiceModalEl ? bootstrap.Modal.getOrCreateInstance(voucherServiceModalEl) : null;
    const voucherGiftModalEl = document.getElementById("voucherGiftModal");
    const voucherGiftModal = voucherGiftModalEl ? bootstrap.Modal.getOrCreateInstance(voucherGiftModalEl) : null;
    const voucherServiceName = voucherServiceModalEl?.querySelector(".js-voucher-service-name");
    const voucherServiceItem = voucherServiceModalEl?.querySelector(".js-voucher-service-item");
    const voucherServiceQuantity = voucherServiceModalEl?.querySelector(".js-voucher-service-quantity");
    const voucherServicePrice = voucherServiceModalEl?.querySelector(".js-voucher-service-price");
    const voucherServiceExpiryMode = voucherServiceModalEl?.querySelector(".js-voucher-service-expiry-mode");
    const voucherServiceExpiryPicker = voucherServiceModalEl?.querySelector(".js-voucher-service-expiry-picker");
    const voucherServiceExpiry = voucherServiceModalEl?.querySelector(".js-voucher-service-expiry");
    const voucherServiceExpiryDropdown = voucherServiceModalEl?.querySelector(".js-voucher-service-expiry-dropdown");
    const voucherServiceExpiryDateInput = voucherServiceModalEl?.querySelector(".js-voucher-service-expiry-date");
    const voucherServiceExpiryClear = voucherServiceModalEl?.querySelector(".js-voucher-service-expiry-clear");
    const voucherServiceLocation = voucherServiceModalEl?.querySelector(".js-voucher-service-location");
    const voucherServiceMessage = voucherServiceModalEl?.querySelector(".js-voucher-service-message");
    const voucherServiceMaxWrap = voucherServiceModalEl?.querySelector(".js-voucher-service-max-wrap");
    const voucherServiceMaxValue = voucherServiceModalEl?.querySelector(".js-voucher-service-max-value");
    const voucherServiceMaxMinus = voucherServiceModalEl?.querySelector(".js-voucher-service-max-minus");
    const voucherServiceMaxPlus = voucherServiceModalEl?.querySelector(".js-voucher-service-max-plus");
    const voucherServicePreviewTitle = voucherServiceModalEl?.querySelector(".js-voucher-service-preview-title");
    const voucherServicePreviewServices = voucherServiceModalEl?.querySelector(".js-voucher-service-preview-services");
    const voucherServicePreviewMessage = voucherServiceModalEl?.querySelector(".js-voucher-service-preview-message");
    const voucherServicePreviewLocation = voucherServiceModalEl?.querySelector(".js-voucher-service-preview-location");
    const voucherServicePreviewDuration = voucherServiceModalEl?.querySelector(".js-voucher-service-preview-duration");
    const voucherServiceSave = voucherServiceModalEl?.querySelector(".js-voucher-service-save");
    const voucherServicePanel = voucherServiceModalEl?.querySelector(".js-voucher-service-panel");
    const voucherServicePanelClose = voucherServiceModalEl?.querySelector(".js-voucher-service-panel-close");
    const voucherServicePanelCancel = voucherServiceModalEl?.querySelector("[data-service-panel-cancel]");
    const voucherServicePanelApply = voucherServiceModalEl?.querySelector(".js-voucher-service-panel-apply");
    const voucherServicePanelSearch = voucherServiceModalEl?.querySelector(".js-voucher-service-search");
    const voucherServicePanelOptions = Array.from(voucherServiceModalEl?.querySelectorAll(".js-voucher-service-option") || []);
    const voucherServiceSelected = voucherServiceModalEl?.querySelector(".js-voucher-service-selected");
    const voucherServicePanelNotice = voucherServiceModalEl?.querySelector(".js-voucher-service-panel-notice");
    const voucherLocationPanel = voucherServiceModalEl?.querySelector(".js-voucher-location-panel");
    const voucherLocationPanelClose = voucherServiceModalEl?.querySelector(".js-voucher-location-panel-close");
    const voucherLocationPanelApply = voucherServiceModalEl?.querySelector(".js-voucher-location-panel-apply");
    const voucherLocationSearch = voucherServiceModalEl?.querySelector(".js-voucher-location-search");
    const voucherLocationOptions = Array.from(voucherServiceModalEl?.querySelectorAll(".js-voucher-location-option") || []);
    const voucherGiftName = voucherGiftModalEl?.querySelector(".js-voucher-gift-name");
    const voucherGiftValue = voucherGiftModalEl?.querySelector(".js-voucher-gift-value");
    const voucherGiftPrice = voucherGiftModalEl?.querySelector(".js-voucher-gift-price");
    const voucherGiftExpiryMode = voucherGiftModalEl?.querySelector(".js-voucher-gift-expiry-mode");
    const voucherGiftExpiryPicker = voucherGiftModalEl?.querySelector(".js-voucher-gift-expiry-picker");
    const voucherGiftExpiry = voucherGiftModalEl?.querySelector(".js-voucher-gift-expiry");
    const voucherGiftExpiryDropdown = voucherGiftModalEl?.querySelector(".js-voucher-gift-expiry-dropdown");
    const voucherGiftExpiryDateInput = voucherGiftModalEl?.querySelector(".js-voucher-gift-expiry-date");
    const voucherGiftExpiryClear = voucherGiftModalEl?.querySelector(".js-voucher-gift-expiry-clear");
    const voucherGiftLocation = voucherGiftModalEl?.querySelector(".js-voucher-gift-location");
    const voucherGiftMessage = voucherGiftModalEl?.querySelector(".js-voucher-gift-message");
    const voucherGiftPreviewTitle = voucherGiftModalEl?.querySelector(".js-voucher-gift-preview-title");
    const voucherGiftSave = voucherGiftModalEl?.querySelector(".js-voucher-gift-save");
    const voucherGiftLocationPanel = voucherGiftModalEl?.querySelector(".js-voucher-gift-location-panel");
    const voucherGiftLocationPanelClose = voucherGiftModalEl?.querySelector(".js-voucher-gift-location-panel-close");
    const voucherGiftLocationPanelApply = voucherGiftModalEl?.querySelector(".js-voucher-gift-location-panel-apply");
    const voucherGiftLocationSearch = voucherGiftModalEl?.querySelector(".js-voucher-gift-location-search");
    const voucherGiftLocationOptions = Array.from(voucherGiftModalEl?.querySelectorAll(".js-voucher-gift-location-option") || []);
    const discountModalEl = document.getElementById("voucherDiscountModal");
    const discountModal = discountModalEl ? bootstrap.Modal.getOrCreateInstance(discountModalEl) : null;
    const discountTitle = discountModalEl?.querySelector(".js-voucher-discount-title");
    const discountName = discountModalEl?.querySelector(".js-voucher-discount-name");
    const discountAmount = discountModalEl?.querySelector(".js-voucher-discount-amount");
    const discountMaxWrap = discountModalEl?.querySelector(".js-voucher-discount-max-wrap");
    const discountMax = discountModalEl?.querySelector(".js-voucher-discount-max");
    const discountDelete = discountModalEl?.querySelector(".js-voucher-discount-delete");
    const discountSave = discountModalEl?.querySelector(".js-voucher-discount-save");
    const discountModes = Array.from(discountModalEl?.querySelectorAll(".js-voucher-discount-mode") || []);
    const discountScopeInputs = Array.from(discountModalEl?.querySelectorAll(".js-voucher-discount-scope") || []);
    let activeTab = "voucher";
    let activeVoucherType = "all";
    let activeDiscountMode = "amount";
    let editingDiscountRow = null;
    let editingVoucherRow = null;
    let servicePickerDraft = [];
    let servicePickerCommitted = [];
    let serviceCombinedMax = 1;
    let servicePanelDropdownOpen = false;
    let servicePanelHideTimer = null;
    let serviceExpiryDropdownOpen = false;
    let serviceExpiryPickerInstance = null;
    let giftExpiryDropdownOpen = false;
    let giftExpiryPickerInstance = null;
    let serviceLocationPanelHideTimer = null;
    let serviceLocationDraft = "Semua Lokasi";
    let giftLocationPanelHideTimer = null;
    let giftLocationDraft = "Semua Lokasi";

    const voucherOptionState = {
        serviceIndex: 0,
        serviceExpiryIndex: 0,
        serviceLocationIndex: 0,
        serviceSpecificDate: "",
        giftExpiryIndex: 0,
        giftLocationIndex: 0,
        giftSpecificDate: "",
    };

    const relativeExpiryChoices = (() => {
        const options = ["No Expiry", "After 1 Week", "After 2 Weeks"];
        for (let month = 1; month <= 11; month += 1) {
            options.push(`After ${month} Month${month > 1 ? "s" : ""}`);
        }
        options.push("After 1 Year");
        for (let month = 1; month <= 11; month += 1) {
            options.push(`After 1 Year ${month} Month${month > 1 ? "s" : ""}`);
        }
        options.push("After 2 Years");
        return options;
    })();
    const specificExpiryChoices = ["31 Dec 2026", "15 Jan 2027", "28 Feb 2027"];
    const locationChoices = ["Semua Lokasi", "Star Salon", "Cabang Utama"];

    const normalize = (value) => String(value || "").trim().toLowerCase();
    const formatDateLabel = (value) => {
        if (!value) {
            return "Pilih Hari";
        }
        const date = new Date(`${value}T00:00:00`);
        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };
    const formatCurrency = (value) => `Rp ${new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))}`;
    const formatPercent = (value) => `${new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))} %`;
    const formatCurrencyInput = (value) => formatCurrency(Number(value || 0));
    const formatCurrencyTyping = (value) => {
        const digits = String(value || "").replace(/\D/g, "");
        if (!digits) {
            return "";
        }
        return `Rp ${new Intl.NumberFormat("id-ID", {
            maximumFractionDigits: 0,
        }).format(Number.parseInt(digits, 10) || 0)}`;
    };
    const parseNumber = (value) => {
        const cleaned = String(value || "").replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".");
        const parsed = Number.parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    };
    const sanitizeDiscountInputValue = (value, mode) => {
        const raw = String(value || "").replace(",", ".");
        let result = "";
        let hasDot = false;
        for (const char of raw) {
            if (/\d/.test(char)) {
                result += char;
                continue;
            }
            if (mode === "percent" && char === "." && !hasDot) {
                result += ".";
                hasDot = true;
            }
        }
        return result;
    };
    const sanitizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");
    const formatCurrencyEditable = (value) => {
        const digits = sanitizeDigitsOnly(value);
        return digits ? formatCurrencyInput(digits) : "";
    };
    const toPlainCurrencyDigits = (value) => {
        const digits = sanitizeDigitsOnly(value);
        if (!digits) {
            return "";
        }
        const normalized = String(Number.parseInt(digits, 10) || 0);
        return normalized === "0" ? "" : normalized;
    };
    const getVoucherRows = () => Array.from(shell.querySelectorAll(".js-voucher-row"));
    const getDiscountRows = () => Array.from(shell.querySelectorAll(".js-voucher-discount-item"));
    const getCheckedScopes = () => discountScopeInputs
        .filter((input) => input.checked)
        .map((input) => input.value);
    const formatVoucherDuration = (label) => {
        const normalized = normalize(label);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(label || "").trim())) return formatDateLabel(label);
        if (normalized === "no expiry") return "Tanpa Kadaluarsa";
        if (normalized.includes("2 weeks")) return "2 Minggu";
        if (normalized.includes("1 week")) return "1 Minggu";
        if (normalized.includes("2 years")) return "2 Tahun";
        if (normalized.includes("1 year 11 months")) return "1 Tahun 11 Bulan";
        if (normalized.includes("1 year 10 months")) return "1 Tahun 10 Bulan";
        if (normalized.includes("1 year 9 months")) return "1 Tahun 9 Bulan";
        if (normalized.includes("1 year 8 months")) return "1 Tahun 8 Bulan";
        if (normalized.includes("1 year 7 months")) return "1 Tahun 7 Bulan";
        if (normalized.includes("1 year 6 months")) return "1 Tahun 6 Bulan";
        if (normalized.includes("1 year 5 months")) return "1 Tahun 5 Bulan";
        if (normalized.includes("1 year 4 months")) return "1 Tahun 4 Bulan";
        if (normalized.includes("1 year 3 months")) return "1 Tahun 3 Bulan";
        if (normalized.includes("1 year 2 months")) return "1 Tahun 2 Bulan";
        if (normalized.includes("1 year 1 month")) return "1 Tahun 1 Bulan";
        if (normalized.includes("1 year")) return "1 Tahun";
        if (normalized.includes("11 months")) return "11 Bulan";
        if (normalized.includes("10 months")) return "10 Bulan";
        if (normalized.includes("9 months")) return "9 Bulan";
        if (normalized.includes("8 months")) return "8 Bulan";
        if (normalized.includes("7 months")) return "7 Bulan";
        if (normalized.includes("6 months")) return "6 Bulan";
        if (normalized.includes("5 months")) return "5 Bulan";
        if (normalized.includes("4 months")) return "4 Bulan";
        if (normalized.includes("3 months")) return "3 Bulan";
        if (normalized.includes("2 months")) return "2 Bulan";
        if (normalized.includes("1 month")) return "1 Bulan";
        return label || "1 Bulan";
    };
    const buildVoucherSearch = (payload) => normalize([
        payload.typeLabel,
        payload.name,
        payload.value,
        payload.duration,
        payload.location,
        payload.status,
    ].join(" "));
    const cloneServiceSelection = (items) => items.map((item) => ({ ...item }));
    const getServicePanelCount = (items) => items.reduce((total, item) => {
        const quantity = Number(item.quantity || 0);
        return quantity > 0 ? total + quantity : total;
    }, 0);
    const getServiceCombinedEnabled = () => voucherServiceQuantity?.getAttribute("aria-pressed") === "true";
    const formatServiceSelectionLabel = (items, isCombined, maxQuantity) => {
        const selected = items.filter((item) => Number(item.quantity || 0) > 0);
        if (selected.length === 0) {
            return "No item";
        }
        const names = selected.map((item) => item.name).join(",");
        return isCombined ? `${maxQuantity}x ${names}` : names;
    };
    const formatServicePreviewLine = (item, isCombined, selectedCount) => {
        const serviceName = String(item?.name || "").trim();
        const quantity = Math.max(1, Number(item?.quantity || 1) || 1);
        if (!serviceName) {
            return "";
        }
        if (isCombined) {
            return serviceName;
        }
        return `${quantity}x ${serviceName}`;
    };
    const syncCombinedQuantityOnItems = (items, quantity) => {
        items.forEach((item) => {
            if (Number(item.quantity || 0) > 0) {
                item.quantity = quantity;
            }
        });
    };
    const syncServiceQuantityUI = () => {
        const isCombined = getServiceCombinedEnabled();
        if (voucherServiceMaxWrap) {
            voucherServiceMaxWrap.hidden = !isCombined;
        }
        if (voucherServicePanelNotice) {
            voucherServicePanelNotice.hidden = !isCombined;
        }
    };
    const syncServiceFormLabel = () => {
        setButtonLabel(
            voucherServiceItem,
            formatServiceSelectionLabel(servicePickerCommitted, getServiceCombinedEnabled(), serviceCombinedMax)
        );
    };
    const getServicePreviewItems = () => {
        const selectedItems = servicePickerCommitted
            .filter((item) => Number(item.quantity || 0) > 0)
            .map((item) => ({
                name: String(item.name || "").trim(),
                quantity: Math.max(1, Number(item.quantity || 1) || 1),
            }))
            .filter((item) => item.name);
        if (selectedItems.length) {
            return selectedItems;
        }
        const labelItems = parseServiceItemsFromLabel(
            getButtonLabel(voucherServiceItem),
            getServiceCombinedEnabled(),
            serviceCombinedMax
        );
        if (labelItems.length) {
            return labelItems;
        }
        const rawLabel = getButtonLabel(voucherServiceItem);
        if (!rawLabel || normalize(rawLabel) === "no item") {
            return [];
        }
        return rawLabel
            .replace(/^\d+x\s+/i, "")
            .split(",")
            .map((name) => String(name || "").trim())
            .filter(Boolean)
            .map((name) => ({ name, quantity: 1 }));
    };
    const parseServiceItemsFromLabel = (label, isCombined = false, maxQuantity = 1) => {
        const rawLabel = String(label || "").trim();
        if (!rawLabel || normalize(rawLabel) === "no item") {
            return [];
        }
        return rawLabel
            .replace(/^\d+x\s+/i, "")
            .split(",")
            .map((part) => String(part || "").trim())
            .filter(Boolean)
            .map((part) => {
                const match = part.match(/^(\d+)x\s+(.+)$/i);
                if (match) {
                    return {
                        name: String(match[2] || "").trim(),
                        quantity: Math.max(1, Number(match[1] || 1) || 1),
                    };
                }
                return {
                    name: part,
                    quantity: isCombined ? Math.max(1, Number(maxQuantity || 1) || 1) : 1,
                };
            })
            .filter((item) => item.name);
    };
    const syncServicePanelApply = () => {
        if (voucherServicePanelApply) {
            voucherServicePanelApply.textContent = `Tambahkan (${getServicePanelCount(servicePickerDraft)})`;
        }
    };
    const syncServiceExpiryDropdown = (forceOpen = serviceExpiryDropdownOpen) => {
        serviceExpiryDropdownOpen = Boolean(forceOpen);
        voucherServiceExpiryPicker?.classList.toggle("is-open", serviceExpiryDropdownOpen);
        if (voucherServiceExpiryDropdown instanceof HTMLElement) {
            voucherServiceExpiryDropdown.hidden = !serviceExpiryDropdownOpen;
        }
    };
    const syncServiceExpiryPickerUI = () => {
        const isSpecific = voucherServiceExpiryMode?.querySelector("[data-expiry-mode='specific']")?.classList.contains("is-active");
        const iconNode = voucherServiceExpiry?.querySelector("i");
        const hasValue = Boolean(voucherOptionState.serviceSpecificDate);
        voucherServiceExpiryPicker?.classList.toggle("is-specific", Boolean(isSpecific));
        voucherServiceExpiryPicker?.classList.toggle("has-value", Boolean(isSpecific && hasValue));
        if (iconNode) {
            iconNode.className = isSpecific ? "bi bi-calendar3" : "bi bi-chevron-down";
        }
        if (voucherServiceExpiryClear instanceof HTMLElement) {
            voucherServiceExpiryClear.hidden = !(isSpecific && hasValue);
        }
    };
    const renderServiceExpiryOptions = () => {
        if (!(voucherServiceExpiryDropdown instanceof HTMLElement)) {
            return;
        }
        const currentLabel = getButtonLabel(voucherServiceExpiry) || relativeExpiryChoices[3];
        voucherServiceExpiryDropdown.innerHTML = relativeExpiryChoices.map((label) => `
            <button class="voucher-expiry-option ${label === currentLabel ? "is-active" : ""}" type="button" data-expiry-choice="${label}">
                ${label}
            </button>
        `).join("");
    };
    const syncGiftExpiryDropdown = (forceOpen = giftExpiryDropdownOpen) => {
        giftExpiryDropdownOpen = Boolean(forceOpen);
        voucherGiftExpiryPicker?.classList.toggle("is-open", giftExpiryDropdownOpen);
        if (voucherGiftExpiryDropdown instanceof HTMLElement) {
            voucherGiftExpiryDropdown.hidden = !giftExpiryDropdownOpen;
        }
    };
    const syncGiftExpiryPickerUI = () => {
        const isSpecific = voucherGiftExpiryMode?.querySelector("[data-expiry-mode='specific']")?.classList.contains("is-active");
        const iconNode = voucherGiftExpiry?.querySelector("i");
        const hasValue = Boolean(voucherOptionState.giftSpecificDate);
        voucherGiftExpiryPicker?.classList.toggle("is-specific", Boolean(isSpecific));
        voucherGiftExpiryPicker?.classList.toggle("has-value", Boolean(isSpecific && hasValue));
        if (iconNode) {
            iconNode.className = isSpecific ? "bi bi-calendar3" : "bi bi-chevron-down";
        }
        if (voucherGiftExpiryClear instanceof HTMLButtonElement) {
            voucherGiftExpiryClear.hidden = !(isSpecific && hasValue);
        }
    };
    const renderGiftExpiryOptions = () => {
        if (!(voucherGiftExpiryDropdown instanceof HTMLElement)) {
            return;
        }
        const currentLabel = getButtonLabel(voucherGiftExpiry) || relativeExpiryChoices[3];
        voucherGiftExpiryDropdown.innerHTML = relativeExpiryChoices.map((label) => `
            <button class="voucher-expiry-option ${label === currentLabel ? "is-active" : ""}" type="button" data-gift-expiry-choice="${label}">
                ${label}
            </button>
        `).join("");
    };
    const syncLocationOptions = () => {
        voucherLocationOptions.forEach((option) => {
            option.classList.toggle("is-selected", (option.dataset.locationName || "") === serviceLocationDraft);
        });
    };
    const syncGiftLocationOptions = () => {
        voucherGiftLocationOptions.forEach((option) => {
            option.classList.toggle("is-selected", (option.dataset.locationName || "") === giftLocationDraft);
        });
    };
    const isVoucherEditorActive = (modalEl) => {
        const toggle = modalEl?.querySelector(".js-voucher-preview-toggle");
        return !(toggle instanceof HTMLElement) || toggle.classList.contains("is-active");
    };
    const syncServicePanelDropdown = (forceOpen = servicePanelDropdownOpen) => {
        servicePanelDropdownOpen = Boolean(forceOpen);
        voucherServicePanel?.classList.toggle("is-searching", servicePanelDropdownOpen);
        const list = voucherServicePanelOptions[0]?.closest(".voucher-service-panel__list");
        if (list instanceof HTMLElement) {
            list.hidden = !servicePanelDropdownOpen;
        }
    };
    const renderServicePanelOptions = () => {
        const query = normalize(voucherServicePanelSearch?.value);
        voucherServicePanelOptions.forEach((option) => {
            const name = option.dataset.serviceName || "";
            const price = option.dataset.servicePrice || "";
            const duration = option.dataset.serviceDuration || "";
            const match = !query || normalize(option.dataset.search).includes(query);
            option.hidden = !match;
            const selected = servicePickerDraft.find((item) => item.name === name);
            const qty = Number(selected?.quantity || 0);
            const action = option.querySelector(".js-voucher-service-option-action");
            if (!(action instanceof HTMLElement)) {
                return;
            }
            action.innerHTML = "";
            option.classList.toggle("is-selected", qty > 0);
            const meta = option.querySelector(".voucher-service-option__meta span");
            if (meta) {
                meta.innerHTML = `${price} <i class="bi bi-dot"></i> ${duration}`;
            }
        });
        const isCombined = getServiceCombinedEnabled();
        if (voucherServiceSelected instanceof HTMLElement) {
            const selectedItems = servicePickerDraft.filter((item) => Number(item.quantity || 0) > 0);
            voucherServiceSelected.hidden = selectedItems.length === 0;
            voucherServiceSelected.innerHTML = selectedItems.map((item) => `
                <div class="voucher-service-selected__item">
                    <div class="voucher-service-selected__meta">
                        <strong>${item.name}</strong>
                        <span>${item.price}</span>
                    </div>
                    ${
                        isCombined
                            ? `<button class="voucher-service-option__remove" type="button" data-service-remove="${item.name}">x</button>`
                            : `
                                <div class="voucher-service-option__stepper">
                                    <span>${Number(item.quantity || 0)}</span>
                                    <button type="button" data-service-minus="${item.name}">-</button>
                                    <button type="button" data-service-plus="${item.name}">+</button>
                                </div>
                            `
                    }
                </div>
            `).join("");
        }
        syncServicePanelApply();
        syncServiceQuantityUI();
    };
    const openServicePanel = () => {
        servicePickerDraft = cloneServiceSelection(servicePickerCommitted);
        if (voucherServicePanelSearch) {
            voucherServicePanelSearch.value = "";
        }
        if (servicePanelHideTimer) {
            window.clearTimeout(servicePanelHideTimer);
            servicePanelHideTimer = null;
        }
        voucherServicePanel?.removeAttribute("hidden");
        voucherServicePanel?.setAttribute("aria-hidden", "false");
        syncServicePanelDropdown(false);
        renderServicePanelOptions();
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                voucherServicePanel?.classList.add("is-open");
                voucherServicePanelSearch?.focus();
            });
        });
    };
    const closeServicePanel = (applyChanges) => {
        if (applyChanges) {
            servicePickerCommitted = cloneServiceSelection(servicePickerDraft);
            syncServiceFormLabel();
            syncServicePreview();
        }
        syncServicePanelDropdown(false);
        voucherServicePanel?.classList.remove("is-open");
        voucherServicePanel?.setAttribute("aria-hidden", "true");
        if (servicePanelHideTimer) {
            window.clearTimeout(servicePanelHideTimer);
        }
        servicePanelHideTimer = window.setTimeout(() => {
            if (!voucherServicePanel?.classList.contains("is-open")) {
                voucherServicePanel?.setAttribute("hidden", "hidden");
            }
            servicePanelHideTimer = null;
        }, 280);
    };
    const openLocationPanel = () => {
        serviceLocationDraft = getButtonLabel(voucherServiceLocation) || locationChoices[0];
        voucherLocationSearch && (voucherLocationSearch.value = "");
        syncLocationOptions();
        voucherLocationOptions.forEach((option) => {
            option.hidden = false;
        });
        if (serviceLocationPanelHideTimer) {
            window.clearTimeout(serviceLocationPanelHideTimer);
            serviceLocationPanelHideTimer = null;
        }
        voucherLocationPanel?.removeAttribute("hidden");
        voucherLocationPanel?.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => {
            voucherLocationPanel?.classList.add("is-open");
            voucherLocationSearch?.focus();
        });
    };
    const closeLocationPanel = (applyChanges) => {
        if (applyChanges) {
            voucherOptionState.serviceLocationIndex = Math.max(0, locationChoices.indexOf(serviceLocationDraft));
            setButtonLabel(voucherServiceLocation, serviceLocationDraft);
            syncServicePreview();
        }
        voucherLocationPanel?.classList.remove("is-open");
        voucherLocationPanel?.setAttribute("aria-hidden", "true");
        if (serviceLocationPanelHideTimer) {
            window.clearTimeout(serviceLocationPanelHideTimer);
        }
        serviceLocationPanelHideTimer = window.setTimeout(() => {
            if (!voucherLocationPanel?.classList.contains("is-open")) {
                voucherLocationPanel?.setAttribute("hidden", "hidden");
            }
            serviceLocationPanelHideTimer = null;
        }, 280);
    };
    const openGiftLocationPanel = () => {
        giftLocationDraft = getButtonLabel(voucherGiftLocation) || locationChoices[0];
        voucherGiftLocationSearch && (voucherGiftLocationSearch.value = "");
        syncGiftLocationOptions();
        voucherGiftLocationOptions.forEach((option) => {
            option.hidden = false;
        });
        if (giftLocationPanelHideTimer) {
            window.clearTimeout(giftLocationPanelHideTimer);
            giftLocationPanelHideTimer = null;
        }
        voucherGiftLocationPanel?.removeAttribute("hidden");
        voucherGiftLocationPanel?.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => {
            voucherGiftLocationPanel?.classList.add("is-open");
            voucherGiftLocationSearch?.focus();
        });
    };
    const closeGiftLocationPanel = (applyChanges) => {
        if (applyChanges) {
            voucherOptionState.giftLocationIndex = Math.max(0, locationChoices.indexOf(giftLocationDraft));
            setButtonLabel(voucherGiftLocation, giftLocationDraft);
            syncGiftPreview();
        }
        voucherGiftLocationPanel?.classList.remove("is-open");
        voucherGiftLocationPanel?.setAttribute("aria-hidden", "true");
        if (giftLocationPanelHideTimer) {
            window.clearTimeout(giftLocationPanelHideTimer);
        }
        giftLocationPanelHideTimer = window.setTimeout(() => {
            if (!voucherGiftLocationPanel?.classList.contains("is-open")) {
                voucherGiftLocationPanel?.setAttribute("hidden", "hidden");
            }
            giftLocationPanelHideTimer = null;
        }, 280);
    };
    const adjustServiceDraftQty = (name, delta) => {
        const option = voucherServicePanelOptions.find((item) => item.dataset.serviceName === name);
        if (!option) return;
        const price = option.dataset.servicePrice || "Rp 0,00";
        const duration = option.dataset.serviceDuration || "";
        const current = servicePickerDraft.find((item) => item.name === name);
        if (!current && delta > 0) {
            servicePickerDraft.push({ name, price, duration, quantity: 1 });
        } else if (current) {
            current.quantity = Math.max(0, Number(current.quantity || 0) + delta);
            if (current.quantity === 0) {
                servicePickerDraft = servicePickerDraft.filter((item) => item.name !== name);
            }
        }
        renderServicePanelOptions();
    };
    const selectServiceOption = (optionCard) => {
        if (!(optionCard instanceof HTMLElement)) {
            return false;
        }
        const optionName = optionCard.dataset.serviceName || "";
        if (!optionName || servicePickerDraft.find((item) => item.name === optionName)) {
            return false;
        }
        const price = optionCard.dataset.servicePrice || "Rp 0,00";
        const duration = optionCard.dataset.serviceDuration || "";
        servicePickerDraft.push({
            name: optionName,
            price,
            duration,
            quantity: getServiceCombinedEnabled() ? serviceCombinedMax : 1,
        });
        if (voucherServicePanelSearch) {
            voucherServicePanelSearch.value = "";
        }
        renderServicePanelOptions();
        syncServicePanelDropdown(false);
        return true;
    };
    const setVoucherToggleState = (toggle, isActive) => {
        if (!(toggle instanceof HTMLElement)) {
            return;
        }
        toggle.classList.toggle("is-active", isActive);
        syncVoucherPreviewShell(toggle);
    };
    const setButtonLabel = (button, text) => {
        const labelNode = button?.querySelector("span");
        if (labelNode) {
            labelNode.textContent = text;
        }
    };
    const getButtonLabel = (button) => button?.querySelector("span")?.textContent?.trim() || "";
    const setSaveEnabled = (button, enabled) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.disabled = !enabled;
        button.classList.toggle("customer-footer-btn--disabled", !enabled);
        button.classList.toggle("staff-save-btn", enabled);
    };
    const ensureServiceExpiryPicker = () => {
        if (serviceExpiryPickerInstance || !voucherServiceExpiryDateInput || typeof flatpickr === "undefined") {
            return serviceExpiryPickerInstance;
        }
        try {
            serviceExpiryPickerInstance = flatpickr(voucherServiceExpiryDateInput, {
                dateFormat: "Y-m-d",
                appendTo: voucherServiceExpiryPicker || undefined,
                positionElement: voucherServiceExpiry || undefined,
                position: "below left",
                onChange: (_selectedDates, dateStr) => {
                    voucherOptionState.serviceSpecificDate = dateStr;
                    setButtonLabel(voucherServiceExpiry, formatDateLabel(dateStr));
                    syncServiceExpiryPickerUI();
                    syncServiceExpiryDropdown(false);
                    syncServicePreview();
                },
                onOpen: () => {
                    syncServiceExpiryPickerUI();
                    syncServiceExpiryDropdown(false);
                },
            });
        } catch (error) {
            console.error("[vouchers] service expiry picker", error);
            serviceExpiryPickerInstance = null;
        }
        return serviceExpiryPickerInstance;
    };
    const ensureGiftExpiryPicker = () => {
        if (giftExpiryPickerInstance || !voucherGiftExpiryDateInput || typeof flatpickr === "undefined") {
            return giftExpiryPickerInstance;
        }
        try {
            giftExpiryPickerInstance = flatpickr(voucherGiftExpiryDateInput, {
                dateFormat: "Y-m-d",
                appendTo: voucherGiftExpiryPicker || undefined,
                positionElement: voucherGiftExpiry || undefined,
                position: "below left",
                onChange: (_selectedDates, dateStr) => {
                    voucherOptionState.giftSpecificDate = dateStr;
                    setButtonLabel(voucherGiftExpiry, formatDateLabel(dateStr));
                    syncGiftExpiryPickerUI();
                    syncGiftExpiryDropdown(false);
                    syncGiftPreview();
                },
                onOpen: () => {
                    syncGiftExpiryPickerUI();
                    syncGiftExpiryDropdown(false);
                },
            });
        } catch (error) {
            console.error("[vouchers] gift expiry picker", error);
            giftExpiryPickerInstance = null;
        }
        return giftExpiryPickerInstance;
    };
    const updateVoucherTotal = () => {
        if (voucherTotalLabel) {
            voucherTotalLabel.textContent = `Total ${getVoucherRows().length}`;
        }
    };
    const syncVoucherRowData = (row, payload) => {
        row.dataset.voucherType = payload.typeKey;
        row.dataset.voucherTypeCode = payload.typeCode;
        row.dataset.voucherTypeLabel = payload.typeLabel;
        row.dataset.voucherName = payload.name;
        row.dataset.voucherValue = payload.value;
        row.dataset.voucherEditorValue = payload.editorValue;
        row.dataset.voucherDuration = payload.duration;
        row.dataset.voucherExpiryLabel = payload.expiryLabel;
        row.dataset.voucherExpiryValue = payload.expiryValue || payload.expiryLabel;
        row.dataset.voucherLocation = payload.location;
        row.dataset.voucherStatus = payload.status;
        row.dataset.voucherServiceName = payload.serviceName || "";
        row.dataset.voucherMessage = payload.message || "Thank you!";
        row.dataset.voucherActive = payload.active ? "1" : "0";
        row.dataset.voucherServices = payload.servicesJson || "[]";
        row.dataset.voucherCombineQuantity = payload.combineQuantity ? "1" : "0";
        row.dataset.voucherMaxQuantity = String(payload.maxQuantity || 1);
        row.dataset.search = buildVoucherSearch(payload);
        const statusClass = payload.active ? "voucher-table__status" : "voucher-table__status voucher-table__status--inactive";
        row.innerHTML = `
            <td>
                <div class="voucher-table__type">
                    <span class="voucher-table__badge voucher-table__badge--${payload.typeKey}">${payload.typeCode}</span>
                    <strong>${payload.typeLabel}</strong>
                </div>
            </td>
            <td><strong>${payload.name}</strong></td>
            <td>${payload.value}</td>
            <td>${payload.duration}</td>
            <td>${payload.location}</td>
            <td><span class="${statusClass}">${payload.status}</span></td>
        `;
    };
    const upsertVoucherRow = (payload) => {
        if (!voucherTableBody) return null;
        let row = editingVoucherRow;
        if (!row) {
            row = document.createElement("tr");
            row.className = "js-voucher-row";
            voucherTableBody.prepend(row);
        }
        syncVoucherRowData(row, payload);
        updateVoucherTotal();
        applyVoucherSearch();
        return row;
    };

    const syncDiscountMode = (mode) => {
        activeDiscountMode = mode === "percent" ? "percent" : "amount";
        discountModes.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.mode === activeDiscountMode);
        });
        if (discountMaxWrap) {
            discountMaxWrap.hidden = activeDiscountMode !== "percent";
        }
        if (discountAmount) {
            discountAmount.value = activeDiscountMode === "percent"
                ? sanitizeDiscountInputValue(discountAmount.value, activeDiscountMode)
                : formatCurrencyTyping(discountAmount.value);
            discountAmount.placeholder = activeDiscountMode === "percent" ? "1.25 %" : "0";
        }
        if (discountMax) {
            discountMax.value = formatCurrencyTyping(discountMax.value);
            discountMax.placeholder = "0";
        }
    };

    const buildDiscountSearch = (name, label) => normalize(`${name} ${label}`);

    const toggleVoucherFabMenu = (forceOpen = null) => {
        if (!voucherFabMenu) {
            return;
        }
        const shouldOpen = forceOpen === null ? voucherFabMenu.hidden : forceOpen;
        voucherFabMenu.hidden = !shouldOpen;
        voucherFabMenu.classList.toggle("is-open", shouldOpen);
    };

    const applyVoucherSearch = () => {
        const query = normalize(voucherSearch?.value);
        voucherTypeFilters.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.voucherType === activeVoucherType);
        });
        getVoucherRows().forEach((row) => {
            const matchesType = activeVoucherType === "all" || row.dataset.voucherType === activeVoucherType;
            const matchesQuery = !query || normalize(row.dataset.search).includes(query);
            row.hidden = !(matchesType && matchesQuery);
        });
    };

    const applyDiscountSearch = () => {
        const query = normalize(discountSearch?.value);
        getDiscountRows().forEach((row) => {
            row.hidden = query && !normalize(row.dataset.search).includes(query);
        });
    };
    const syncVoucherPreviewShell = (toggle) => {
        if (!(toggle instanceof HTMLElement)) {
            return;
        }
        const shellNode = toggle.closest(".vouchers-preview-shell");
        if (!(shellNode instanceof HTMLElement)) {
            return;
        }
        const body = shellNode.querySelector(".js-voucher-preview-body");
        const empty = shellNode.querySelector(".js-voucher-preview-empty");
        const isActive = toggle.classList.contains("is-active");
        toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
        if (body instanceof HTMLElement) {
            body.hidden = !isActive;
        }
        if (empty instanceof HTMLElement) {
            empty.hidden = isActive;
        }
    };

    const applyTab = (tabName) => {
        activeTab = tabName === "discount" ? "discount" : "voucher";
        tabs.forEach((tab) => {
            const isActive = tab.dataset.vouchersTab === activeTab;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", isActive ? "true" : "false");
        });
        panels.forEach((panel) => {
            const isActive = panel.dataset.vouchersPanel === activeTab;
            panel.classList.toggle("is-active", isActive);
            panel.hidden = !isActive;
        });
        if (activeTab !== "voucher") {
            toggleVoucherFabMenu(false);
        }
    };

    const resetDiscountForm = () => {
        editingDiscountRow = null;
        if (discountTitle) discountTitle.textContent = "Buat Diskon";
        if (discountName) discountName.value = "";
        if (discountAmount) discountAmount.value = formatCurrencyInput(0);
        if (discountMax) discountMax.value = formatCurrencyInput(0);
        if (discountDelete) discountDelete.hidden = true;
        discountScopeInputs.forEach((input) => {
            input.checked = true;
        });
        syncDiscountMode("amount");
    };

    const populateDiscountForm = (row) => {
        editingDiscountRow = row;
        if (discountTitle) discountTitle.textContent = "Edit Diskon";
        if (discountName) discountName.value = row.dataset.discountName || "";
        if (discountAmount) {
            discountAmount.value = (row.dataset.discountMode || "amount") === "percent"
                ? sanitizeDiscountInputValue(row.dataset.discountAmount || "", "percent")
                : formatCurrencyTyping(row.dataset.discountAmount || "");
        }
        if (discountMax) {
            discountMax.value = formatCurrencyTyping(row.dataset.discountMax || "");
        }
        let scopes = [];
        try {
            scopes = JSON.parse(row.dataset.discountScopes || "[]");
        } catch (error) {
            scopes = [];
        }
        discountScopeInputs.forEach((input) => {
            input.checked = scopes.length === 0 || scopes.includes(input.value);
        });
        if (discountDelete) discountDelete.hidden = false;
        syncDiscountMode(row.dataset.discountMode || "amount");
    };

    const buildDiscountRow = (payload) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "voucher-discount-item js-voucher-discount-item";
        row.dataset.discountId = payload.id;
        row.dataset.discountName = payload.name;
        row.dataset.discountMode = payload.mode;
        row.dataset.discountAmount = String(payload.amount);
        row.dataset.discountMax = payload.maxLabel;
        row.dataset.discountScopes = JSON.stringify(payload.scopes);
        row.dataset.search = buildDiscountSearch(payload.name, payload.amountLabel);
        row.innerHTML = `<strong>${payload.name}</strong><span>${payload.amountLabel}</span>`;
        return row;
    };

    const saveDiscount = () => {
        const name = String(discountName?.value || "").trim();
        if (!name) {
            discountName?.focus();
            return;
        }
        const amount = parseNumber(discountAmount?.value || 0);
        const maxValue = parseNumber(discountMax?.value || 0);
        const scopes = getCheckedScopes();
        const amountLabel = activeDiscountMode === "percent"
            ? formatPercent(amount)
            : formatCurrency(amount);
        const payload = {
            id: editingDiscountRow?.dataset.discountId || String(Date.now()),
            name,
            mode: activeDiscountMode,
            amount,
            amountLabel,
            maxLabel: activeDiscountMode === "percent" ? formatCurrency(maxValue) : "",
            scopes,
        };
        const targetRow = editingDiscountRow || buildDiscountRow(payload);
        targetRow.dataset.discountId = payload.id;
        targetRow.dataset.discountName = payload.name;
        targetRow.dataset.discountMode = payload.mode;
        targetRow.dataset.discountAmount = String(payload.amount);
        targetRow.dataset.discountMax = payload.maxLabel;
        targetRow.dataset.discountScopes = JSON.stringify(payload.scopes);
        targetRow.dataset.search = buildDiscountSearch(payload.name, payload.amountLabel);
        targetRow.innerHTML = `<strong>${payload.name}</strong><span>${payload.amountLabel}</span>`;
        if (!editingDiscountRow) {
            discountList?.prepend(targetRow);
        }
        discountModal?.hide();
        applyDiscountSearch();
    };

    const openDiscountCreate = () => {
        resetDiscountForm();
        discountModal?.show();
    };

    const openDiscountEdit = (row) => {
        populateDiscountForm(row);
        discountModal?.show();
    };
    const syncServicePreview = () => {
        syncServiceFormLabel();
        const currentServiceLabel = getButtonLabel(voucherServiceItem);
        const selectedItems = getServicePreviewItems();
        const isCombined = getServiceCombinedEnabled();
        const selectedServiceLabel = formatServiceSelectionLabel(
            servicePickerCommitted,
            getServiceCombinedEnabled(),
            serviceCombinedMax
        );
        const fallbackServiceLabel = normalize(selectedServiceLabel) !== "no item"
            ? selectedServiceLabel
            : (normalize(currentServiceLabel) !== "no item" ? currentServiceLabel : "");
        const displayName = String(voucherServiceName?.value || "").trim() || fallbackServiceLabel || "Voucher Layanan";
        if (voucherServicePreviewTitle) {
            voucherServicePreviewTitle.textContent = displayName;
        }
        if (voucherServicePreviewServices) {
            const serviceLines = selectedItems.length
                ? selectedItems
                    .map((item) => formatServicePreviewLine(item, isCombined, selectedItems.length))
                    .filter(Boolean)
                : parseServiceItemsFromLabel(
                    fallbackServiceLabel,
                    isCombined,
                    serviceCombinedMax
                ).map((item, index, items) => formatServicePreviewLine(item, isCombined, items.length)).filter(Boolean);
            voucherServicePreviewServices.innerHTML = selectedItems.length
                ? serviceLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")
                : serviceLines.length
                    ? serviceLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")
                    : "";
        }
        if (voucherServicePreviewMessage) {
            voucherServicePreviewMessage.textContent = String(voucherServiceMessage?.value || "").trim() || "Thank you!";
        }
        if (voucherServicePreviewLocation) {
            voucherServicePreviewLocation.innerHTML = `<i class="bi bi-geo-alt"></i> Dapat digunakan di ${getButtonLabel(voucherServiceLocation) || "Semua Lokasi"}`;
        }
        if (voucherServicePreviewDuration) {
            voucherServicePreviewDuration.textContent = `Valid untuk ${formatVoucherDuration(voucherOptionState.serviceSpecificDate || getButtonLabel(voucherServiceExpiry) || "After 1 Month")}`;
        }
        setSaveEnabled(voucherServiceSave, String(voucherServiceName?.value || "").trim() !== "" && servicePickerCommitted.length > 0);
    };
    const syncGiftPreview = () => {
        if (voucherGiftPreviewTitle) {
            const digits = sanitizeDigitsOnly(voucherGiftValue?.value || "");
            voucherGiftPreviewTitle.textContent = digits ? formatCurrency(digits) : "Rp 0,00";
        }
        setSaveEnabled(voucherGiftSave, String(voucherGiftName?.value || "").trim() !== "");
    };
    const resetServiceEditor = () => {
        editingVoucherRow = null;
        voucherOptionState.serviceExpiryIndex = 3;
        voucherOptionState.serviceLocationIndex = 0;
        voucherOptionState.serviceSpecificDate = "";
        serviceCombinedMax = 1;
        servicePickerCommitted = [];
        servicePickerDraft = [];
        if (voucherServiceModalEl?.querySelector(".customer-modal__header h2")) {
            voucherServiceModalEl.querySelector(".customer-modal__header h2").textContent = "Voucher Layanan Baru";
        }
        if (voucherServiceName) voucherServiceName.value = "";
        if (voucherServiceQuantity instanceof HTMLButtonElement) {
            voucherServiceQuantity.setAttribute("aria-pressed", "false");
            voucherServiceQuantity.classList.remove("is-active");
        }
        if (voucherServiceMaxValue) {
            voucherServiceMaxValue.textContent = "1";
        }
        if (voucherServicePrice) voucherServicePrice.value = formatCurrencyInput(0);
        voucherServiceExpiryMode?.querySelectorAll("button").forEach((button, index) => {
            button.classList.toggle("is-active", index === 0);
        });
        setButtonLabel(voucherServiceExpiry, relativeExpiryChoices[3]);
        setButtonLabel(voucherServiceLocation, locationChoices[0]);
        syncServiceExpiryPickerUI();
        if (voucherServiceMessage) voucherServiceMessage.value = "Thank you!";
        setVoucherToggleState(voucherServiceModalEl?.querySelector(".js-voucher-preview-toggle"), true);
        serviceExpiryPickerInstance?.clear();
        closeServicePanel(false);
        syncServiceExpiryDropdown(false);
        closeLocationPanel(false);
        syncServiceQuantityUI();
        syncServicePreview();
    };
    const resetGiftEditor = () => {
        editingVoucherRow = null;
        voucherOptionState.giftExpiryIndex = 3;
        voucherOptionState.giftLocationIndex = 0;
        voucherOptionState.giftSpecificDate = "";
        if (voucherGiftModalEl?.querySelector(".customer-modal__header h2")) {
            voucherGiftModalEl.querySelector(".customer-modal__header h2").textContent = "Voucher Hadiah Baru";
        }
        if (voucherGiftName) voucherGiftName.value = "";
        if (voucherGiftValue) voucherGiftValue.value = formatCurrencyInput(0);
        if (voucherGiftPrice) voucherGiftPrice.value = formatCurrencyInput(0);
        voucherGiftExpiryMode?.querySelectorAll("button").forEach((button, index) => {
            button.classList.toggle("is-active", index === 0);
        });
        setButtonLabel(voucherGiftExpiry, relativeExpiryChoices[3]);
        setButtonLabel(voucherGiftLocation, locationChoices[0]);
        if (voucherGiftMessage) voucherGiftMessage.value = "Thank you!";
        setVoucherToggleState(voucherGiftModalEl?.querySelector(".js-voucher-preview-toggle"), true);
        giftExpiryPickerInstance?.clear();
        syncGiftExpiryDropdown(false);
        syncGiftExpiryPickerUI();
        closeGiftLocationPanel(false);
        syncGiftPreview();
    };
    const populateServiceEditor = (row) => {
        editingVoucherRow = row;
        if (voucherServiceModalEl?.querySelector(".customer-modal__header h2")) {
            voucherServiceModalEl.querySelector(".customer-modal__header h2").textContent = "Edit Voucher Layanan";
        }
        if (voucherServiceName) voucherServiceName.value = row.dataset.voucherName || "";
        try {
            servicePickerCommitted = JSON.parse(row.dataset.voucherServices || "[]");
        } catch (error) {
            servicePickerCommitted = [];
        }
        if (voucherServicePrice) {
            voucherServicePrice.value = formatCurrencyInput(sanitizeDigitsOnly(row.dataset.voucherEditorValue || "0"));
        }
        setButtonLabel(voucherServiceExpiry, row.dataset.voucherExpiryLabel || "After 1 Month");
        setButtonLabel(voucherServiceLocation, row.dataset.voucherLocation || "Semua Lokasi");
        if (voucherServiceMessage) voucherServiceMessage.value = row.dataset.voucherMessage || "Thank you!";
        if (voucherServiceQuantity instanceof HTMLButtonElement) {
            const isCombined = row.dataset.voucherCombineQuantity === "1";
            voucherServiceQuantity.setAttribute("aria-pressed", isCombined ? "true" : "false");
            voucherServiceQuantity.classList.toggle("is-active", isCombined);
        }
        serviceCombinedMax = Number(row.dataset.voucherMaxQuantity || 1) || 1;
        if (voucherServiceMaxValue) {
            voucherServiceMaxValue.textContent = String(serviceCombinedMax);
        }
        if (!servicePickerCommitted.length) {
            servicePickerCommitted = parseServiceItemsFromLabel(
                row.dataset.voucherValue || row.dataset.voucherServiceName || "",
                row.dataset.voucherCombineQuantity === "1",
                serviceCombinedMax
            );
        }
        voucherServiceExpiryMode?.querySelectorAll("button").forEach((button) => {
            const rowExpiry = row.dataset.voucherExpiryLabel || "";
            const mode = normalize(rowExpiry).startsWith("after") || normalize(rowExpiry) === "no expiry" ? "relative" : "specific";
            button.classList.toggle("is-active", (button.dataset.expiryMode || "relative") === mode);
        });
        voucherOptionState.serviceSpecificDate = normalize(row.dataset.voucherExpiryLabel).startsWith("after") || normalize(row.dataset.voucherExpiryLabel) === "no expiry"
            ? ""
            : (row.dataset.voucherExpiryValue || "");
        if (/^\d{4}-\d{2}-\d{2}$/.test(voucherOptionState.serviceSpecificDate)) {
            serviceExpiryPickerInstance?.setDate(voucherOptionState.serviceSpecificDate, false);
            setButtonLabel(voucherServiceExpiry, formatDateLabel(voucherOptionState.serviceSpecificDate));
        } else {
            serviceExpiryPickerInstance?.clear();
        }
        syncServiceExpiryPickerUI();
        setVoucherToggleState(voucherServiceModalEl?.querySelector(".js-voucher-preview-toggle"), row.dataset.voucherActive !== "0");
        syncServiceQuantityUI();
        syncServicePreview();
    };
    const populateGiftEditor = (row) => {
        editingVoucherRow = row;
        if (voucherGiftModalEl?.querySelector(".customer-modal__header h2")) {
            voucherGiftModalEl.querySelector(".customer-modal__header h2").textContent = "Edit Voucher Hadiah";
        }
        if (voucherGiftName) voucherGiftName.value = row.dataset.voucherName || "";
        if (voucherGiftValue) voucherGiftValue.value = formatCurrencyInput(sanitizeDigitsOnly(row.dataset.voucherEditorValue || "0"));
        if (voucherGiftPrice) voucherGiftPrice.value = formatCurrencyInput(sanitizeDigitsOnly(row.dataset.voucherEditorValue || "0"));
        setButtonLabel(voucherGiftExpiry, row.dataset.voucherExpiryLabel || "After 1 Month");
        setButtonLabel(voucherGiftLocation, row.dataset.voucherLocation || "Semua Lokasi");
        if (voucherGiftMessage) voucherGiftMessage.value = row.dataset.voucherMessage || "Thank you!";
        voucherGiftExpiryMode?.querySelectorAll("button").forEach((button) => {
            const rowExpiry = row.dataset.voucherExpiryLabel || "";
            const mode = /\d/.test(rowExpiry) && !normalize(rowExpiry).includes("after") ? "specific" : "relative";
            button.classList.toggle("is-active", (button.dataset.expiryMode || "relative") === mode);
        });
        voucherOptionState.giftSpecificDate = /^\d{4}-\d{2}-\d{2}$/.test(row.dataset.voucherExpiryValue || "")
            ? (row.dataset.voucherExpiryValue || "")
            : "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(voucherOptionState.giftSpecificDate)) {
            giftExpiryPickerInstance?.setDate(voucherOptionState.giftSpecificDate, false);
            setButtonLabel(voucherGiftExpiry, formatDateLabel(voucherOptionState.giftSpecificDate));
        } else {
            giftExpiryPickerInstance?.clear();
        }
        syncGiftExpiryDropdown(false);
        syncGiftExpiryPickerUI();
        setVoucherToggleState(voucherGiftModalEl?.querySelector(".js-voucher-preview-toggle"), row.dataset.voucherActive !== "0");
        closeGiftLocationPanel(false);
        syncGiftPreview();
    };
    const saveServiceVoucher = () => {
        const name = String(voucherServiceName?.value || "").trim();
        if (!name) {
            voucherServiceName?.focus();
            return;
        }
        upsertVoucherRow({
            typeKey: "service",
            typeCode: "S",
            typeLabel: "Service Type",
            name,
            value: formatServiceSelectionLabel(servicePickerCommitted, getServiceCombinedEnabled(), serviceCombinedMax),
            editorValue: sanitizeDigitsOnly(voucherServicePrice?.value || "0"),
            duration: formatVoucherDuration(getButtonLabel(voucherServiceExpiry) || "After 1 Month"),
            expiryLabel: getButtonLabel(voucherServiceExpiry) || "After 1 Month",
            expiryValue: voucherOptionState.serviceSpecificDate || getButtonLabel(voucherServiceExpiry) || "After 1 Month",
            location: getButtonLabel(voucherServiceLocation) || "Semua Lokasi",
            status: isVoucherEditorActive(voucherServiceModalEl) ? "Active" : "Disable",
            serviceName: formatServiceSelectionLabel(servicePickerCommitted, getServiceCombinedEnabled(), serviceCombinedMax),
            message: String(voucherServiceMessage?.value || "").trim() || "Thank you!",
            active: isVoucherEditorActive(voucherServiceModalEl),
            servicesJson: JSON.stringify(servicePickerCommitted),
            combineQuantity: getServiceCombinedEnabled(),
            maxQuantity: serviceCombinedMax,
        });
        voucherServiceModal?.hide();
    };
    const saveGiftVoucher = () => {
        const name = String(voucherGiftName?.value || "").trim();
        if (!name) {
            voucherGiftName?.focus();
            return;
        }
        const amountDigits = sanitizeDigitsOnly(voucherGiftValue?.value || "0");
        upsertVoucherRow({
            typeKey: "gift",
            typeCode: "G",
            typeLabel: "Gift Type",
            name,
            value: formatCurrency(amountDigits || 0),
            editorValue: amountDigits || "0",
            duration: formatVoucherDuration(getButtonLabel(voucherGiftExpiry) || "After 1 Month"),
            expiryLabel: getButtonLabel(voucherGiftExpiry) || "After 1 Month",
            expiryValue: voucherOptionState.giftSpecificDate || getButtonLabel(voucherGiftExpiry) || "After 1 Month",
            location: getButtonLabel(voucherGiftLocation) || "Semua Lokasi",
            status: isVoucherEditorActive(voucherGiftModalEl) ? "Active" : "Disable",
            serviceName: "",
            message: String(voucherGiftMessage?.value || "").trim() || "Thank you!",
            active: isVoucherEditorActive(voucherGiftModalEl),
        });
        voucherGiftModal?.hide();
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            applyTab(tab.dataset.vouchersTab || "voucher");
        });
    });

    voucherTypeFilters.forEach((button) => {
        button.addEventListener("click", () => {
            activeVoucherType = button.dataset.voucherType || "all";
            applyVoucherSearch();
        });
    });

    voucherSearch?.addEventListener("input", applyVoucherSearch);
    discountSearch?.addEventListener("input", applyDiscountSearch);

    fab?.addEventListener("click", () => {
        if (activeTab === "discount") {
            openDiscountCreate();
            return;
        }
        toggleVoucherFabMenu();
    });

    voucherFabClose?.addEventListener("click", () => {
        toggleVoucherFabMenu(false);
    });

    voucherCreateTriggers.forEach((button) => {
        button.addEventListener("click", () => {
            toggleVoucherFabMenu(false);
            const target = button.dataset.voucherCreate || "service";
            if (target === "gift") {
                resetGiftEditor();
                voucherGiftModal?.show();
                return;
            }
            resetServiceEditor();
            voucherServiceModal?.show();
        });
    });

    voucherPreviewToggles.forEach((toggle) => {
        syncVoucherPreviewShell(toggle);
        toggle.addEventListener("click", () => {
            toggle.classList.toggle("is-active");
            syncVoucherPreviewShell(toggle);
        });
    });

    discountList?.addEventListener("click", (event) => {
        const row = event.target instanceof HTMLElement ? event.target.closest(".js-voucher-discount-item") : null;
        if (!row) {
            return;
        }
        openDiscountEdit(row);
    });

    discountModes.forEach((button) => {
        button.addEventListener("click", () => {
            syncDiscountMode(button.dataset.mode || "amount");
        });
    });

    discountAmount?.addEventListener("input", () => {
        discountAmount.value = activeDiscountMode === "percent"
            ? sanitizeDiscountInputValue(discountAmount.value, activeDiscountMode)
            : formatCurrencyTyping(discountAmount.value);
    });

    discountMax?.addEventListener("input", () => {
        discountMax.value = formatCurrencyTyping(discountMax.value);
    });

    discountAmount?.addEventListener("focus", () => {
        if (activeDiscountMode === "amount") {
            discountAmount.value = discountAmount.value === formatCurrencyInput(0)
                ? ""
                : formatCurrencyTyping(discountAmount.value);
        }
    });

    discountMax?.addEventListener("focus", () => {
        discountMax.value = discountMax.value === formatCurrencyInput(0)
            ? ""
            : formatCurrencyTyping(discountMax.value);
    });

    discountAmount?.addEventListener("blur", () => {
        if (activeDiscountMode === "amount") {
            const digits = sanitizeDigitsOnly(discountAmount.value);
            discountAmount.value = digits ? formatCurrencyInput(digits) : formatCurrencyInput(0);
        }
    });

    discountMax?.addEventListener("blur", () => {
        const digits = sanitizeDigitsOnly(discountMax.value);
        discountMax.value = digits ? formatCurrencyInput(digits) : formatCurrencyInput(0);
    });

    discountDelete?.addEventListener("click", () => {
        if (!editingDiscountRow) {
            return;
        }
        editingDiscountRow.remove();
        editingDiscountRow = null;
        discountModal?.hide();
        applyDiscountSearch();
    });

    discountSave?.addEventListener("click", saveDiscount);

    voucherTableBody?.addEventListener("click", (event) => {
        const row = event.target instanceof HTMLElement ? event.target.closest(".js-voucher-row") : null;
        if (!(row instanceof HTMLElement)) {
            return;
        }
        if (row.dataset.voucherType === "gift") {
            populateGiftEditor(row);
            voucherGiftModal?.show();
            return;
        }
        populateServiceEditor(row);
        voucherServiceModal?.show();
    });

    voucherServiceName?.addEventListener("input", syncServicePreview);
    voucherServiceMessage?.addEventListener("input", syncServicePreview);
    voucherServicePrice?.addEventListener("input", () => {
        voucherServicePrice.value = formatCurrencyTyping(voucherServicePrice.value);
    });
    voucherServicePrice?.addEventListener("blur", () => {
        const digits = sanitizeDigitsOnly(voucherServicePrice.value);
        voucherServicePrice.value = digits ? formatCurrencyInput(digits) : formatCurrencyInput(0);
    });
    voucherServiceItem?.addEventListener("click", () => {
        openServicePanel();
    });
    voucherServiceExpiryMode?.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
            const mode = button.dataset.expiryMode || "relative";
            voucherServiceExpiryMode.querySelectorAll("button").forEach((item) => {
                item.classList.toggle("is-active", item === button);
            });
            if (mode === "specific") {
                setButtonLabel(voucherServiceExpiry, voucherOptionState.serviceSpecificDate ? formatDateLabel(voucherOptionState.serviceSpecificDate) : "Pilih Hari");
                syncServiceExpiryDropdown(false);
            } else {
                if (!relativeExpiryChoices[voucherOptionState.serviceExpiryIndex]) {
                    voucherOptionState.serviceExpiryIndex = 3;
                }
                setButtonLabel(voucherServiceExpiry, relativeExpiryChoices[voucherOptionState.serviceExpiryIndex]);
                renderServiceExpiryOptions();
            }
            syncServiceExpiryPickerUI();
            if (mode === "specific") ensureServiceExpiryPicker()?.open();
            syncServicePreview();
        });
    });
    voucherServiceExpiry?.addEventListener("click", () => {
        const isSpecific = voucherServiceExpiryMode?.querySelector("[data-expiry-mode='specific']")?.classList.contains("is-active");
        if (isSpecific) {
            ensureServiceExpiryPicker()?.open();
        } else {
            renderServiceExpiryOptions();
            syncServiceExpiryDropdown(!serviceExpiryDropdownOpen);
        }
    });
    voucherServiceExpiryClear?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        voucherOptionState.serviceSpecificDate = "";
        serviceExpiryPickerInstance?.clear();
        setButtonLabel(voucherServiceExpiry, "Pilih Hari");
        syncServiceExpiryPickerUI();
        syncServiceExpiryDropdown(false);
        syncServicePreview();
    });
    voucherServiceLocation?.addEventListener("click", () => {
        openLocationPanel();
    });
    voucherServiceQuantity?.addEventListener("click", () => {
        const isPressed = voucherServiceQuantity.getAttribute("aria-pressed") === "true";
        voucherServiceQuantity.setAttribute("aria-pressed", isPressed ? "false" : "true");
        voucherServiceQuantity.classList.toggle("is-active", !isPressed);
        if (isPressed) {
            serviceCombinedMax = 1;
            if (voucherServiceMaxValue) {
                voucherServiceMaxValue.textContent = "1";
            }
        }
        syncCombinedQuantityOnItems(servicePickerCommitted, getServiceCombinedEnabled() ? serviceCombinedMax : 1);
        syncCombinedQuantityOnItems(servicePickerDraft, getServiceCombinedEnabled() ? serviceCombinedMax : 1);
        syncServiceQuantityUI();
        syncServiceFormLabel();
        syncServicePreview();
        if (voucherServicePanel?.classList.contains("is-open")) {
            renderServicePanelOptions();
        }
    });
    voucherServiceMaxMinus?.addEventListener("click", () => {
        serviceCombinedMax = Math.max(1, serviceCombinedMax - 1);
        if (voucherServiceMaxValue) {
            voucherServiceMaxValue.textContent = String(serviceCombinedMax);
        }
        syncCombinedQuantityOnItems(servicePickerCommitted, serviceCombinedMax);
        syncCombinedQuantityOnItems(servicePickerDraft, serviceCombinedMax);
        syncServiceFormLabel();
        syncServicePreview();
        if (voucherServicePanel?.classList.contains("is-open")) {
            renderServicePanelOptions();
        }
    });
    voucherServiceMaxPlus?.addEventListener("click", () => {
        serviceCombinedMax += 1;
        if (voucherServiceMaxValue) {
            voucherServiceMaxValue.textContent = String(serviceCombinedMax);
        }
        syncCombinedQuantityOnItems(servicePickerCommitted, serviceCombinedMax);
        syncCombinedQuantityOnItems(servicePickerDraft, serviceCombinedMax);
        syncServiceFormLabel();
        syncServicePreview();
        if (voucherServicePanel?.classList.contains("is-open")) {
            renderServicePanelOptions();
        }
    });
    voucherServicePanelClose?.addEventListener("click", () => {
        closeServicePanel(false);
    });
    voucherServicePanelCancel?.addEventListener("click", () => {
        closeServicePanel(false);
    });
    voucherServicePanelApply?.addEventListener("click", () => {
        closeServicePanel(true);
    });
    voucherServiceExpiryDropdown?.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest("[data-expiry-choice]") : null;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const label = target.dataset.expiryChoice || relativeExpiryChoices[3];
        voucherOptionState.serviceExpiryIndex = Math.max(0, relativeExpiryChoices.indexOf(label));
        setButtonLabel(voucherServiceExpiry, label);
        renderServiceExpiryOptions();
        syncServiceExpiryDropdown(false);
        syncServiceExpiryPickerUI();
        syncServicePreview();
    });
    voucherServicePanelSearch?.addEventListener("click", () => {
        const query = normalize(voucherServicePanelSearch.value);
        if (!query) {
            syncServicePanelDropdown(!servicePanelDropdownOpen);
        } else if (!servicePanelDropdownOpen) {
            syncServicePanelDropdown(true);
        }
        renderServicePanelOptions();
    });
    voucherServicePanelSearch?.addEventListener("input", () => {
        syncServicePanelDropdown(true);
        renderServicePanelOptions();
    });
    voucherServicePanel?.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target) {
            return;
        }
        if (
            !target.closest(".voucher-service-panel__search") &&
            !target.closest(".voucher-service-panel__list")
        ) {
            syncServicePanelDropdown(false);
        }
        const optionCard = target.closest(".js-voucher-service-option");
        if (optionCard instanceof HTMLElement && !target.closest("[data-service-minus],[data-service-plus],[data-service-add],[data-service-remove]")) {
            if (selectServiceOption(optionCard)) {
                return;
            }
        }
        const plusName = target.getAttribute("data-service-plus");
        const minusName = target.getAttribute("data-service-minus");
        const addName = target.getAttribute("data-service-add");
        const removeName = target.getAttribute("data-service-remove");
        if (plusName) {
            adjustServiceDraftQty(plusName, 1);
            return;
        }
        if (minusName) {
            adjustServiceDraftQty(minusName, -1);
            return;
        }
        if (addName) {
            adjustServiceDraftQty(addName, 1);
            return;
        }
        if (removeName) {
            servicePickerDraft = servicePickerDraft.filter((item) => item.name !== removeName);
            renderServicePanelOptions();
        }
    });
    voucherLocationPanelClose?.addEventListener("click", () => {
        closeLocationPanel(false);
    });
    voucherLocationPanelApply?.addEventListener("click", () => {
        closeLocationPanel(true);
    });
    voucherLocationSearch?.addEventListener("input", () => {
        const query = normalize(voucherLocationSearch.value);
        voucherLocationOptions.forEach((option) => {
            option.hidden = query && !normalize(option.dataset.locationName).includes(query);
        });
    });
    voucherLocationPanel?.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest(".js-voucher-location-option") : null;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        serviceLocationDraft = target.dataset.locationName || locationChoices[0];
        syncLocationOptions();
    });
    voucherServiceSave?.addEventListener("click", saveServiceVoucher);

    voucherGiftName?.addEventListener("input", syncGiftPreview);
    [voucherGiftValue, voucherGiftPrice].forEach((input) => {
        input?.addEventListener("input", () => {
            input.value = formatCurrencyTyping(input.value);
            syncGiftPreview();
        });
        input?.addEventListener("blur", () => {
            const digits = sanitizeDigitsOnly(input.value);
            input.value = digits ? formatCurrencyInput(digits) : formatCurrencyInput(0);
            syncGiftPreview();
        });
    });
    voucherGiftExpiryMode?.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
            const mode = button.dataset.expiryMode || "relative";
            voucherGiftExpiryMode.querySelectorAll("button").forEach((item) => {
                item.classList.toggle("is-active", item === button);
            });
            if (mode === "specific") {
                setButtonLabel(voucherGiftExpiry, voucherOptionState.giftSpecificDate ? formatDateLabel(voucherOptionState.giftSpecificDate) : "Pilih Hari");
                syncGiftExpiryDropdown(false);
            } else {
                if (!relativeExpiryChoices[voucherOptionState.giftExpiryIndex]) {
                    voucherOptionState.giftExpiryIndex = 3;
                }
                setButtonLabel(voucherGiftExpiry, relativeExpiryChoices[voucherOptionState.giftExpiryIndex]);
                renderGiftExpiryOptions();
            }
            syncGiftExpiryPickerUI();
            if (mode === "specific") ensureGiftExpiryPicker()?.open();
            syncGiftPreview();
        });
    });
    voucherGiftExpiry?.addEventListener("click", () => {
        const isSpecific = voucherGiftExpiryMode?.querySelector("[data-expiry-mode='specific']")?.classList.contains("is-active");
        if (isSpecific) {
            ensureGiftExpiryPicker()?.open();
        } else {
            renderGiftExpiryOptions();
            syncGiftExpiryDropdown(!giftExpiryDropdownOpen);
        }
    });
    voucherGiftExpiryClear?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        voucherOptionState.giftSpecificDate = "";
        giftExpiryPickerInstance?.clear();
        setButtonLabel(voucherGiftExpiry, "Pilih Hari");
        syncGiftExpiryPickerUI();
        syncGiftExpiryDropdown(false);
        syncGiftPreview();
    });
    voucherGiftExpiryDropdown?.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest("[data-gift-expiry-choice]") : null;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const label = target.dataset.giftExpiryChoice || relativeExpiryChoices[3];
        voucherOptionState.giftExpiryIndex = Math.max(0, relativeExpiryChoices.indexOf(label));
        setButtonLabel(voucherGiftExpiry, label);
        renderGiftExpiryOptions();
        syncGiftExpiryDropdown(false);
        syncGiftExpiryPickerUI();
        syncGiftPreview();
    });
    voucherGiftLocation?.addEventListener("click", () => {
        openGiftLocationPanel();
    });
    voucherGiftMessage?.addEventListener("input", syncGiftPreview);
    voucherGiftSave?.addEventListener("click", saveGiftVoucher);
    voucherGiftLocationPanelClose?.addEventListener("click", () => {
        closeGiftLocationPanel(false);
    });
    voucherGiftLocationPanelApply?.addEventListener("click", () => {
        closeGiftLocationPanel(true);
    });
    voucherGiftLocationSearch?.addEventListener("input", () => {
        const query = normalize(voucherGiftLocationSearch.value);
        voucherGiftLocationOptions.forEach((option) => {
            option.hidden = query && !normalize(option.dataset.locationName).includes(query);
        });
    });
    voucherGiftLocationPanel?.addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest(".js-voucher-gift-location-option") : null;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        giftLocationDraft = target.dataset.locationName || locationChoices[0];
        syncGiftLocationOptions();
    });

    voucherServiceModalEl?.addEventListener("hidden.bs.modal", () => {
        resetServiceEditor();
    });
    voucherGiftModalEl?.addEventListener("hidden.bs.modal", () => {
        resetGiftEditor();
    });

    discountModalEl?.addEventListener("hidden.bs.modal", () => {
        resetDiscountForm();
    });

    document.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && !event.target.closest(".js-voucher-service-expiry-picker")) {
            syncServiceExpiryDropdown(false);
        }
        if (event.target instanceof HTMLElement && !event.target.closest(".js-voucher-gift-expiry-picker")) {
            syncGiftExpiryDropdown(false);
        }
        if (
            voucherFabMenu?.hidden ||
            !(event.target instanceof HTMLElement) ||
            event.target.closest(".js-vouchers-fab") ||
            event.target.closest(".js-voucher-fab-menu")
        ) {
            return;
        }
        toggleVoucherFabMenu(false);
    });

    applyTab("voucher");
    applyVoucherSearch();
    applyDiscountSearch();
}

function initAnalyticsPage() {
    const shell = document.querySelector(".js-analytics-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".analytics-tab"));
    const panels = Array.from(shell.querySelectorAll(".analytics-panel"));
    const cards = Array.from(shell.querySelectorAll("[data-report-card]"));
    const groups = Array.from(shell.querySelectorAll("[data-report-group]"));
    const items = Array.from(shell.querySelectorAll("[data-report-item]"));
    const detail = shell.querySelector("[data-analytics-detail]");
    const backLabel = shell.querySelector("[data-report-back] span");
    const popover = shell.querySelector("[data-report-popover]");
    const closeButton = shell.querySelector("[data-report-close]");

    const applyTab = (tabName) => {
        tabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.analyticsTab === tabName);
        });

        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.analyticsPanel === tabName);
        });

        if (tabName === "reports") {
            popover?.classList.add("is-open");
        }
    };

    const applyReportGroup = (groupKey) => {
        cards.forEach((card) => {
            card.classList.toggle("is-selected", card.dataset.reportKey === groupKey);
        });

        groups.forEach((group) => {
            group.classList.toggle("is-active", group.dataset.reportGroup === groupKey);
        });

        popover?.classList.add("is-open");
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => applyTab(tab.dataset.analyticsTab));
    });

    cards.forEach((card) => {
        card.addEventListener("click", () => {
            applyReportGroup(card.dataset.reportKey);
        });
    });

    items.forEach((item) => {
        item.addEventListener("click", () => {
            items.forEach((button) => button.classList.remove("is-active"));
            item.classList.add("is-active");
            if (backLabel) {
                backLabel.textContent = item.dataset.reportTitle || "Ringkasan laporan";
            }
            detail?.classList.add("is-active");
        });
    });

    closeButton?.addEventListener("click", () => {
        popover?.classList.remove("is-open");
    });

    shell.querySelector("[data-report-back]")?.addEventListener("click", () => {
        detail?.classList.remove("is-active");
        popover?.classList.add("is-open");
    });

    applyTab("overview");
    applyReportGroup("finance");
}

function initReviewsPage() {
    const shell = document.querySelector(".js-reviews-shell");
    if (!shell) {
        return;
    }

    const tabs = Array.from(shell.querySelectorAll(".reviews-tab"));
    const panels = Array.from(shell.querySelectorAll(".reviews-panel"));

    const applyTab = (tabName) => {
        tabs.forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.reviewsTab === tabName);
        });

        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.dataset.reviewsPanel === tabName);
        });
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => applyTab(tab.dataset.reviewsTab));
    });

    applyTab("customer");
}

function initPOS() {
    document.querySelectorAll(".js-pos-form").forEach((form) => {
        const addButtons = form.querySelectorAll(".js-pos-add");
        const itemsField = form.querySelector(".js-pos-items");
        const listNode = form.querySelector(".js-pos-list");
        const subtotalNode = form.querySelector(".js-subtotal");
        const discountNode = form.querySelector(".js-discount");
        const totalNode = form.querySelector(".js-total");
        const voucherField = form.querySelector(".js-voucher-code");
        let items = [];

        const renderCart = async () => {
            itemsField.value = JSON.stringify(items);
            listNode.innerHTML = items.length
                ? items.map((item, index) => `<div class="d-flex justify-content-between align-items-center"><span>${item.name}</span><span>${formatCurrency(item.price)} <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-2" data-remove="${index}">x</button></span></div>`).join("")
                : "<div class='text-muted small'>Belum ada item.</div>";

            const body = new URLSearchParams();
            body.append("items_json", JSON.stringify(items));
            body.append("voucher_code", voucherField?.value || "");

            const response = await fetch("/api/pos/calculate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: body.toString(),
            });
            const data = await response.json();
            subtotalNode.textContent = formatCurrency(data.subtotal);
            discountNode.textContent = formatCurrency(data.discount);
            totalNode.textContent = formatCurrency(data.total);

            listNode.querySelectorAll("[data-remove]").forEach((button) => {
                button.addEventListener("click", () => {
                    items.splice(Number(button.dataset.remove), 1);
                    renderCart();
                });
            });
        };

        addButtons.forEach((button) => {
            button.addEventListener("click", () => {
                items.push({
                    type: button.dataset.type,
                    name: button.dataset.name,
                    price: Number(button.dataset.price),
                    qty: 1,
                });
                renderCart();
            });
        });

        voucherField?.addEventListener("change", renderCart);
        renderCart();
    });
}

function initPermissionLoader() {
    document.querySelectorAll(".js-permission-form").forEach((form) => {
        const staffSelect = form.querySelector(".js-permission-staff");
        if (!staffSelect) {
            return;
        }

        const checkboxes = Array.from(form.querySelectorAll("input[type='checkbox'][name='permissions[]']"));
        const applyPermissions = async () => {
            const response = await fetch(`/api/settings/staff-permissions?staff_id=${staffSelect.value}`);
            const data = await response.json();
            checkboxes.forEach((checkbox) => {
                checkbox.checked = (data.permissions || []).includes(checkbox.value);
            });
        };

        staffSelect.addEventListener("change", applyPermissions);
        applyPermissions();
    });
}
