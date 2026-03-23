-- Disable triggers to bypass validations (admin reagendamento)
ALTER TABLE appointments DISABLE TRIGGER validate_appointment_cpf_restriction_trigger;
ALTER TABLE appointments DISABLE TRIGGER validate_dependent_appointment_limit_trigger;
ALTER TABLE appointments DISABLE TRIGGER trg_enforce_booking_window_on_appointments;
ALTER TABLE appointments DISABLE TRIGGER validate_holiday_before_appointment;

INSERT INTO appointments (appointment_date, clinic_id, dependent_id, duration_minutes, end_time, patient_id, professional_id, start_time, status, type) VALUES
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '08:30:00', 'd5e0d5b9-26a5-42b2-b511-62b0cc6eee5f', '3a79f7b1-adcf-417e-8896-22c707bd963b', '08:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', 'a04dc84c-9a94-40a7-bd19-b70fab5b3b95', 30, '09:00:00', 'd5e0d5b9-26a5-42b2-b511-62b0cc6eee5f', '3a79f7b1-adcf-417e-8896-22c707bd963b', '08:30:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', 'dcda399a-96de-437c-91f4-dbd375a7b467', 30, '09:30:00', '0a465f79-20fc-4d30-a1f6-d38220806c6f', '3a79f7b1-adcf-417e-8896-22c707bd963b', '09:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', '3f407578-1f0c-4b58-9972-35e23e1eeddf', 30, '10:00:00', 'c8b6eeae-18c6-429c-bf45-ee39d5bd1bab', '3a79f7b1-adcf-417e-8896-22c707bd963b', '09:30:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', '8dbb857f-7fbb-4327-93e1-1b319aa6bd22', 30, '10:30:00', '76ac5721-76cc-4199-9c16-e8f96dfc6862', '3a79f7b1-adcf-417e-8896-22c707bd963b', '10:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '11:00:00', '67f3b4b4-7e81-400e-8187-39c5324961b8', '3a79f7b1-adcf-417e-8896-22c707bd963b', '10:30:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', '97a9991d-0f24-412c-9a2e-da2edce9ebb4', 30, '14:30:00', 'a0748a00-1526-4dec-bb5a-2cef3692409c', '3a79f7b1-adcf-417e-8896-22c707bd963b', '14:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '15:00:00', '7bbe45d5-8457-4d5f-a5c6-a11eb20dea2e', '3a79f7b1-adcf-417e-8896-22c707bd963b', '14:30:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '15:30:00', '98ba44ac-e6c7-4c52-b0ca-22797fc92e65', '3a79f7b1-adcf-417e-8896-22c707bd963b', '15:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', '54c8c4f0-f334-4075-a992-71dd6ec3df72', 30, '16:00:00', '98ba44ac-e6c7-4c52-b0ca-22797fc92e65', '3a79f7b1-adcf-417e-8896-22c707bd963b', '15:30:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '16:30:00', '2b81c712-dd02-4f82-b2b7-892f3011c378', '3a79f7b1-adcf-417e-8896-22c707bd963b', '16:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '17:00:00', '9898ddca-15ab-4380-84e8-703668088374', '3a79f7b1-adcf-417e-8896-22c707bd963b', '16:30:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', NULL, 30, '16:30:00', 'd57353ca-fad7-45fe-b101-adabe8be97a6', '3a79f7b1-adcf-417e-8896-22c707bd963b', '16:00:00', 'scheduled', 'first_visit'),
('2026-03-30', '89e7585e-7bce-4e58-91fa-c37080d1170d', '8a2532c5-fc74-4fb2-a407-da5f7c9eaec5', 30, '17:00:00', 'd57353ca-fad7-45fe-b101-adabe8be97a6', '3a79f7b1-adcf-417e-8896-22c707bd963b', '16:30:00', 'scheduled', 'first_visit');

-- Re-enable triggers
ALTER TABLE appointments ENABLE TRIGGER validate_appointment_cpf_restriction_trigger;
ALTER TABLE appointments ENABLE TRIGGER validate_dependent_appointment_limit_trigger;
ALTER TABLE appointments ENABLE TRIGGER trg_enforce_booking_window_on_appointments;
ALTER TABLE appointments ENABLE TRIGGER validate_holiday_before_appointment;