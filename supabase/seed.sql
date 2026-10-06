SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict UZpne27CGriA1RpwWJIqJOWRqXXLlHCA6dzAkMAVRDPuS0mO00ZIARJ66H2j7aR

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =========================================================================
-- Multi-tenancy seed shim
-- =========================================================================
-- Use a fixed seed organization ID so this works even when seed.sql is
-- executed in batches/connections. Do not use a TEMP table here.
INSERT INTO "public"."organizations" ("id", "name", "slug")
VALUES ('00000000-0000-0000-0000-000000000001', 'Blue Box Seed Co', 'blue-box-seed')
ON CONFLICT ("id") DO NOTHING;

-- Existing seed rows do not contain org_id. Temporarily allow NULL while
-- the dump data is loaded; org_id is backfilled at the end of this file.
ALTER TABLE "public"."items"             ALTER COLUMN "org_id" DROP NOT NULL;
ALTER TABLE "public"."inventory_balance" ALTER COLUMN "org_id" DROP NOT NULL;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', 'a0e9b10d-b578-438f-8be0-25395232b24a', 'authenticated', 'authenticated', 'piyushjb72@hotmail.com', '$2a$10$6I3G01rJViw6y0aJKqeG9uLlCisaMUvCI5cI2cbGXh3BSl9GOH/gS', '2026-05-19 03:22:39.998235+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-05-19 19:28:55.49523+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-05-19 03:22:39.962058+00', '2026-05-25 22:47:51.896807+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('a0e9b10d-b578-438f-8be0-25395232b24a', 'a0e9b10d-b578-438f-8be0-25395232b24a', '{"sub": "a0e9b10d-b578-438f-8be0-25395232b24a", "email": "piyushjb72@hotmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-05-19 03:22:39.995228+00', '2026-05-19 03:22:39.995284+00', '2026-05-19 03:22:39.995284+00', '0bc6d077-e2ee-43a2-ae84-48720d4432e3');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('c0ffadfa-f75f-4b21-869e-607392552594', 'a0e9b10d-b578-438f-8be0-25395232b24a', '2026-05-19 19:28:55.496363+00', '2026-05-26 00:01:18.348776+00', NULL, 'aal1', NULL, '2026-05-26 00:01:18.346903', 'Next.js Middleware', '182.48.226.32', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('c0ffadfa-f75f-4b21-869e-607392552594', '2026-05-19 19:28:55.572503+00', '2026-05-19 19:28:55.572503+00', 'password', '233e7c0f-1171-42e0-b5f7-77dc3c40922a');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 5, 'obbtbwypc2dx', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-19 19:28:55.534392+00', '2026-05-20 14:24:04.275416+00', NULL, 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 6, '4xaqj7jfqtt7', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-20 14:24:04.286979+00', '2026-05-20 15:37:49.114704+00', 'obbtbwypc2dx', 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 7, 'bl6o5l7njz5c', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-20 15:37:49.127742+00', '2026-05-21 02:21:01.684357+00', '4xaqj7jfqtt7', 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 8, '2dvlxq5j5a2a', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-21 02:21:01.701401+00', '2026-05-21 03:32:25.02045+00', 'bl6o5l7njz5c', 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 9, 'ntzkujhcbufj', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-21 03:32:25.040013+00', '2026-05-23 10:03:47.9838+00', '2dvlxq5j5a2a', 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 10, 'vzhlmkvoiox2', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-23 10:03:47.999853+00', '2026-05-25 05:42:56.794779+00', 'ntzkujhcbufj', 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 11, 'c736773rn5ve', 'a0e9b10d-b578-438f-8be0-25395232b24a', true, '2026-05-25 05:42:56.812519+00', '2026-05-25 22:47:51.866811+00', 'vzhlmkvoiox2', 'c0ffadfa-f75f-4b21-869e-607392552594'),
	('00000000-0000-0000-0000-000000000000', 12, 'nen5unh2cr47', 'a0e9b10d-b578-438f-8be0-25395232b24a', false, '2026-05-25 22:47:51.884364+00', '2026-05-25 22:47:51.884364+00', 'c736773rn5ve', 'c0ffadfa-f75f-4b21-869e-607392552594');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "full_name", "role", "phone", "is_active", "created_at", "updated_at") VALUES
	('a0e9b10d-b578-438f-8be0-25395232b24a', 'Piyush Joshi', 'manager', NULL, true, '2026-05-19 03:22:39.961577+00', '2026-05-19 03:23:22.013979+00');


--
-- Data for Name: approvals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."audit_logs" ("id", "table_name", "record_id", "action", "old_values", "new_values", "changed_by", "changed_at") VALUES
	('60c3ee67-0fbb-4084-89f9-9bd5258e0f4a', 'items', '4d7648eb-ce9e-4a58-8012-9c482369f919', 'INSERT', NULL, '{"id": "4d7648eb-ce9e-4a58-8012-9c482369f919", "name": "ACSR Dog Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-001", "size_spec": "0.1 sqmm | 2.5mtr/kg | 394kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "ACSR", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4fe82b7f-751d-4861-bff0-4e817625cac6', 'items', 'fb20b785-e3fe-488c-971c-f633f89bbcee', 'INSERT', NULL, '{"id": "fb20b785-e3fe-488c-971c-f633f89bbcee", "name": "ACSR Raccoon Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-002", "size_spec": "80 sqmm | 3.2mtr/kg | 310kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "ACSR", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('bf1d5d77-68e4-42df-91f4-7ed6d8651ac9', 'items', '1e42e2e3-2763-485c-afa4-122a9aab01ab', 'INSERT', NULL, '{"id": "1e42e2e3-2763-485c-afa4-122a9aab01ab", "name": "ACSR Rabbit Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-003", "size_spec": "50 sqmm | 4.7mtr/kg | 214kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "ACSR", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b34b9d0e-e0ce-4769-a650-63df5bb549c0', 'items', 'ac3491c9-3d5c-4c7f-b31a-7183b7d2f595', 'INSERT', NULL, '{"id": "ac3491c9-3d5c-4c7f-b31a-7183b7d2f595", "name": "ACSR Weasel Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-004", "size_spec": "O3 | 7.8mtr/kg | 128kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "ACSR", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1472c1e2-bc68-483d-937c-6115dd8127a7', 'items', '4a6c2381-49be-45b2-bf75-01dcad6a31f0', 'INSERT', NULL, '{"id": "4a6c2381-49be-45b2-bf75-01dcad6a31f0", "name": "ACSR Panther Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-005", "size_spec": "0.25sqmm | 1km/kg | 974kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "ACSR", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('48f8280a-b925-4a75-931a-de1b2fa28cad', 'items', 'fcd5573a-b248-4f98-ace2-c27b487fa4e3', 'INSERT', NULL, '{"id": "fcd5573a-b248-4f98-ace2-c27b487fa4e3", "name": "AAC Gnat Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-006", "size_spec": "25sqmm | 13.5mtr/kg | 74kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AAC", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8b91acd2-cec3-4f6e-a533-dda42a98470d', 'items', 'dcb40665-6af5-4ce4-803b-eb306cf0e108', 'INSERT', NULL, '{"id": "dcb40665-6af5-4ce4-803b-eb306cf0e108", "name": "AAC Ladybird Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-007", "size_spec": "45sqmm | 8.5mtr/kg | 117kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AAC", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('326b8c5a-bb12-4b48-91d1-92c0f1bc4d6d', 'items', 'cca51cfe-1cf3-4762-9614-af2ef6bd858e', 'INSERT', NULL, '{"id": "cca51cfe-1cf3-4762-9614-af2ef6bd858e", "name": "AAAC Weasel Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-008", "size_spec": "34sqmm | 10mtr/kg | 94kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AAAC", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('53a0b0a6-b200-4ec4-b86d-87c5e7148028', 'items', '9a73997d-ab62-459a-bc6d-5b27dc23155c', 'INSERT', NULL, '{"id": "9a73997d-ab62-459a-bc6d-5b27dc23155c", "name": "AAAC Ant Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-009", "size_spec": "55sqmm | 7mtr/kg | 145kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AAAC", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7e85e619-d763-4817-902b-4d49407d513d', 'items', '2cee4916-d0f5-44b9-9ba9-4c50f6ab8154', 'INSERT', NULL, '{"id": "2cee4916-d0f5-44b9-9ba9-4c50f6ab8154", "name": "AAAC Raccoon Conductor", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-010", "size_spec": "80sqmm | 4.6mtr/kg | 218kg/km", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AAAC", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('6398b7e7-3590-4468-85ae-26fd1aa6ecd7', 'items', '31a961ff-09a4-49d7-9678-0ad2b8f090dd', 'INSERT', NULL, '{"id": "31a961ff-09a4-49d7-9678-0ad2b8f090dd", "name": "LT AAC Conductor 55sqmm", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-011", "size_spec": "55sqmm | 7mtr/kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5596cbb6-196f-49f9-b1a1-023534914bfa', 'items', '497636a5-a0aa-4858-b22c-1a364c56adb9', 'INSERT', NULL, '{"id": "497636a5-a0aa-4858-b22c-1a364c56adb9", "name": "LT AA Conductor 34sqmm", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-012", "size_spec": "34sqmm | 13mtr/kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('21e6c722-0e05-4d86-bef5-f5f220549791', 'items', '1eb48110-e7e1-4984-a4f9-4eda2498c920', 'INSERT', NULL, '{"id": "1eb48110-e7e1-4984-a4f9-4eda2498c920", "name": "HT Conductor 50sqmm", "unit": "Mtr", "notes": null, "category": "Conductor", "hsn_code": "7604", "is_active": true, "is_traded": true, "item_code": "CON-013", "size_spec": "50sqmm | 4.7mtr/kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('c8d62d34-d71b-4dbd-a9fe-1058baf0ff9d', 'items', 'e6800f87-d71a-4593-aaab-76f12aaddd98', 'INSERT', NULL, '{"id": "e6800f87-d71a-4593-aaab-76f12aaddd98", "name": "LT Cable 300sqmm 4 Core Armoured XLPE", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-001", "size_spec": "300sqmm 4C XLPE", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT Armoured", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7997bc69-e49c-4dc7-b89a-8ad443bfd127', 'items', '1fa48fb8-f7eb-4b8a-b338-95f6e58e5f3f', 'INSERT', NULL, '{"id": "1fa48fb8-f7eb-4b8a-b338-95f6e58e5f3f", "name": "LT Cable 300sqmm 3.5 Core Armoured XLPE", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-002", "size_spec": "300sqmm 3.5C XLPE", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT Armoured", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('76551214-ff55-47cb-aef1-5df28ba355c3', 'items', '20bc41ea-57fa-46a1-ab41-30a5a2b33465', 'INSERT', NULL, '{"id": "20bc41ea-57fa-46a1-ab41-30a5a2b33465", "name": "HT Cable 95sqmm 3 Core Armoured XLPE", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-003", "size_spec": "95sqmm 3C XLPE", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT Armoured", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('ea953f83-4bc3-4d01-a97b-3f0529194707', 'items', '57e3d734-5e39-4a9b-bfaa-6a099ef132dd', 'INSERT', NULL, '{"id": "57e3d734-5e39-4a9b-bfaa-6a099ef132dd", "name": "LT Cable 50sqmm", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-004", "size_spec": "50sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('05d1095e-c977-4e42-89cb-99558787674e', 'items', '25b9dde2-39db-4278-95b7-4885486da10a', 'INSERT', NULL, '{"id": "25b9dde2-39db-4278-95b7-4885486da10a", "name": "LT Cable 70sqmm", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-005", "size_spec": "70sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('75cb75e4-c1b3-44b1-962c-1c01817a4ffc', 'items', 'da76d712-55fc-45f9-8658-529d80e1eb9d', 'INSERT', NULL, '{"id": "da76d712-55fc-45f9-8658-529d80e1eb9d", "name": "LT Cable 95sqmm", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-006", "size_spec": "95sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('2e286299-b8b1-4ea5-b190-75ba5aa1152a', 'items', 'e886e1bf-c809-46e2-b809-6c1186e54efa', 'INSERT', NULL, '{"id": "e886e1bf-c809-46e2-b809-6c1186e54efa", "name": "LT Cable 120sqmm", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-007", "size_spec": "120sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e3667132-5bbb-4e04-a595-ee92e3757460', 'items', '77d0060d-b86d-48f0-b919-6f2fd5001074', 'INSERT', NULL, '{"id": "77d0060d-b86d-48f0-b919-6f2fd5001074", "name": "LT Cable 185sqmm", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-008", "size_spec": "185sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b8e5b3f4-8d85-4cc4-b93b-35c9a823b378', 'items', '0c518c21-bf8a-485b-b16f-fb83214963fa', 'INSERT', NULL, '{"id": "0c518c21-bf8a-485b-b16f-fb83214963fa", "name": "LT Cable 240sqmm", "unit": "Mtr", "notes": null, "category": "Cable", "hsn_code": "8544", "is_active": true, "is_traded": true, "item_code": "CAB-009", "size_spec": "240sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('cc44073e-8f2f-4d50-8a3c-0532c0d31a83', 'items', 'd0bc9683-34ae-40b5-b789-b445fe2969ed', 'INSERT', NULL, '{"id": "d0bc9683-34ae-40b5-b789-b445fe2969ed", "name": "Pin Insulator Polymer 11KV 24mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-001", "size_spec": "11KV FRP 24MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pin Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3ab46a05-e8fb-4851-9c3f-812f49e112ac', 'items', '7cea46cb-5d5d-46ab-b88b-299173478b36', 'INSERT', NULL, '{"id": "7cea46cb-5d5d-46ab-b88b-299173478b36", "name": "Pin Insulator Polymer 11KV 16mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-002", "size_spec": "11KV FRP 16MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pin Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9f015bd8-902e-4665-8186-ba119286f86f', 'items', '7a1ad911-f478-4156-b25f-06f6fae089d1', 'INSERT', NULL, '{"id": "7a1ad911-f478-4156-b25f-06f6fae089d1", "name": "Post Insulator Polymer 11KV 24mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-003", "size_spec": "11KV 57PCD 24MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Post Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a699624d-0fcf-4272-b5f3-26d974b7acc2', 'items', '4a329c4b-9321-482a-9fd4-47277d474733', 'INSERT', NULL, '{"id": "4a329c4b-9321-482a-9fd4-47277d474733", "name": "Post Insulator Polymer 11KV 16mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-004", "size_spec": "11KV 57PCD 16MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Post Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('99b8f23d-c3fb-4bd9-9c53-f20fa7ec7895', 'items', '29ba375d-f89b-4d9f-b3e6-ccc5a5e657e1', 'INSERT', NULL, '{"id": "29ba375d-f89b-4d9f-b3e6-ccc5a5e657e1", "name": "Pin Insulator Polymer 22KV 24mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-005", "size_spec": "22KV FRP 24MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pin Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('244cbbb0-108f-4e2d-b5b8-00713ec4b19c', 'items', '76d475ff-7be0-4141-892a-75768785ff06', 'INSERT', NULL, '{"id": "76d475ff-7be0-4141-892a-75768785ff06", "name": "Post Insulator Polymer 22KV 24mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-006", "size_spec": "22KV 57PCD 24MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Post Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('57d60d6f-c19f-45f6-be1c-0c613570c849', 'items', 'cd1639f8-2113-4eb7-805a-527145d51975', 'INSERT', NULL, '{"id": "cd1639f8-2113-4eb7-805a-527145d51975", "name": "Post Insulator Polymer 33KV 24mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-007", "size_spec": "33KV 76PCD 24MM", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Post Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b2dd0803-0ccf-4063-b6b1-3425765115f5', 'items', '3c243971-f0c8-478f-8c2a-7ca192cda69b', 'INSERT', NULL, '{"id": "3c243971-f0c8-478f-8c2a-7ca192cda69b", "name": "Disc Insulator 11KV 45KN", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-008", "size_spec": "11KV 45KN", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Disc", "material_type": "Mixed", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('352f8133-c9f0-4ac8-914b-3fc2d2f54e88', 'items', 'e1717152-ade4-46db-9983-fe9ae8038bf7', 'INSERT', NULL, '{"id": "e1717152-ade4-46db-9983-fe9ae8038bf7", "name": "Disc Insulator 11KV 70KN", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-009", "size_spec": "11KV 70KN", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Disc", "material_type": "Mixed", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a82799c3-bb67-43c2-9864-401069509ac9', 'items', '9a70a3cf-63ae-41b4-9b81-14f3143e447d', 'INSERT', NULL, '{"id": "9a70a3cf-63ae-41b4-9b81-14f3143e447d", "name": "Disc Insulator 22KV 70KN", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-010", "size_spec": "22KV 70KN", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Disc", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4c8815cd-fb9f-4111-a965-d0dba172c9ec', 'items', '41555e43-f5aa-4ff8-8777-dcf46cb106b0', 'INSERT', NULL, '{"id": "41555e43-f5aa-4ff8-8777-dcf46cb106b0", "name": "Disc Insulator 33KV 70KN", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-011", "size_spec": "33KV 70KN", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Disc", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('449e6b2a-272e-4ee2-a806-b799e1bf15e9', 'items', '11ac6621-b11a-4ed9-8610-77ecdc764bce', 'INSERT', NULL, '{"id": "11ac6621-b11a-4ed9-8610-77ecdc764bce", "name": "Pin Insulator 11KV Stud 16mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-012", "size_spec": "11KV Stud 16mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pin Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('66621c05-fbd8-4a9d-b694-ca43ac6c24e5', 'items', '6e695d1d-f348-4ee9-88b1-f89e921fc40e', 'INSERT', NULL, '{"id": "6e695d1d-f348-4ee9-88b1-f89e921fc40e", "name": "Pin Insulator 11KV Stud 20mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-013", "size_spec": "11KV Stud 20mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pin Polymer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4656a822-236e-4ce6-bb30-e8f8d7116add', 'items', 'adaf15ef-c5e9-4966-9643-7b13d8abf2f8', 'INSERT', NULL, '{"id": "adaf15ef-c5e9-4966-9643-7b13d8abf2f8", "name": "Stay Insulator LT 90x65mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-014", "size_spec": "90x65mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "Porcelain", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('44d1361a-1779-4bee-adc2-e5022bf4771e', 'items', '0839f432-be5a-4443-be47-1828988ad619', 'INSERT', NULL, '{"id": "0839f432-be5a-4443-be47-1828988ad619", "name": "Shackle Insulator LT 90x75mm", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-015", "size_spec": "90x75mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Shackle", "material_type": "Porcelain", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('96f9404b-1585-491e-b922-ae3ea9a6c146', 'items', 'bd21bc5f-3bb9-4d12-9b40-856f782a8d1d', 'INSERT', NULL, '{"id": "bd21bc5f-3bb9-4d12-9b40-856f782a8d1d", "name": "Post Insulator 11KV", "unit": "No.", "notes": null, "category": "Insulator", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "INS-016", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Post", "material_type": "Mixed", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5cf698b3-3697-4532-b0f8-73b152559771', 'items', '7eb8ea32-0aaa-44b4-862b-8ba38926d8c7', 'INSERT', NULL, '{"id": "7eb8ea32-0aaa-44b4-862b-8ba38926d8c7", "name": "Channel 100x50 11ft GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-001", "size_spec": "100x50x11ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Channel", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('d5b6ac29-0c2b-40d9-8dc1-e30c03996846', 'items', '0dbd4a96-d1cc-4c41-8e27-97675d449ae2', 'INSERT', NULL, '{"id": "0dbd4a96-d1cc-4c41-8e27-97675d449ae2", "name": "Channel 100x50 11ft MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-002", "size_spec": "100x50x11ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Channel", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('2c0de408-3703-4e49-8686-a5c84fdb9214', 'items', 'cbe0dcce-765e-49ce-81c5-fb93162230ed', 'INSERT', NULL, '{"id": "cbe0dcce-765e-49ce-81c5-fb93162230ed", "name": "Channel 75x40 11ft GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-003", "size_spec": "75x40x11ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Channel", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('08d29155-9a4b-46f8-ae26-a664e1eddd36', 'items', 'f22643d6-3337-4f29-8c49-7387a628a948', 'INSERT', NULL, '{"id": "f22643d6-3337-4f29-8c49-7387a628a948", "name": "Channel 75x40 11ft MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-004", "size_spec": "75x40x11ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Channel", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('df73edb0-cccd-4962-acb1-8f1b86f2e370', 'items', '9e67f896-84fb-45d3-b263-0dd2340d0b3c', 'INSERT', NULL, '{"id": "9e67f896-84fb-45d3-b263-0dd2340d0b3c", "name": "Guarding Channel 75x40 7ft GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-005", "size_spec": "75x40x7ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Guarding Channel", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('222dcf94-f27c-4b3c-87ca-07c91ca33b99', 'items', 'eb877e5c-d92b-4ff4-b553-faed8ebcce0b', 'INSERT', NULL, '{"id": "eb877e5c-d92b-4ff4-b553-faed8ebcce0b", "name": "Guarding Channel 75x40 7ft MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-006", "size_spec": "75x40x7ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Guarding Channel", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('19f6bc8b-3ac9-4a33-addb-dc07b50b461c', 'items', 'f672af6d-1212-4931-96d0-14a60eda3298', 'INSERT', NULL, '{"id": "f672af6d-1212-4931-96d0-14a60eda3298", "name": "Suspension Channel 100x50 8ft GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-007", "size_spec": "100x50x8ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Suspension Channel", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('80f2398a-7343-4d1b-b833-788f8f8cabb1', 'items', '6876df5c-56fc-493e-be32-6065511c9451', 'INSERT', NULL, '{"id": "6876df5c-56fc-493e-be32-6065511c9451", "name": "Suspension Channel 100x50 8ft MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-008", "size_spec": "100x50x8ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Suspension Channel", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('ddfd0f58-2d5e-4777-865f-6dca8603801a', 'items', '45ff3595-3dac-4e0f-baba-4e91e91926df', 'INSERT', NULL, '{"id": "45ff3595-3dac-4e0f-baba-4e91e91926df", "name": "Angle 2 Pin 3.9Kg GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-009", "size_spec": "2 Pin 3.9kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Angle", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0b661037-e858-496c-a520-ef7bd3766982', 'items', '2001b93d-67bd-4a50-96b0-c430e1fee7ba', 'INSERT', NULL, '{"id": "2001b93d-67bd-4a50-96b0-c430e1fee7ba", "name": "Angle 2 Pin 3.9Kg MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-010", "size_spec": "2 Pin 3.9kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Angle", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f709f6ca-297f-4c8f-b895-0f3b57b1d855', 'items', 'c64affe5-cb15-4afe-8072-f6226243b388', 'INSERT', NULL, '{"id": "c64affe5-cb15-4afe-8072-f6226243b388", "name": "Angle 4 Pin 7Kg GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-011", "size_spec": "4 Pin 7kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Angle", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('c2d7c17d-1604-4f14-ab4c-74631bb51fb4', 'items', '0fe74bd6-ab53-4256-9f03-97b0f8b21979', 'INSERT', NULL, '{"id": "0fe74bd6-ab53-4256-9f03-97b0f8b21979", "name": "Angle 4 Pin 7Kg MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-012", "size_spec": "4 Pin 7kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Angle", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f3b0c630-952e-41d1-83b2-c309d09f8709', 'items', '7aa4312b-f0f8-4370-b3d5-10c5d56032a0', 'INSERT', NULL, '{"id": "7aa4312b-f0f8-4370-b3d5-10c5d56032a0", "name": "Patti 5 Hole GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-013", "size_spec": "5 hole", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e17f723b-f967-4c5b-9725-8fbd97581aea', 'items', 'fa468152-f3ed-4d3e-879e-a4416afe88de', 'INSERT', NULL, '{"id": "fa468152-f3ed-4d3e-879e-a4416afe88de", "name": "Patti 5 Hole MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-014", "size_spec": "5 hole", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e1f77bdf-9123-4a9e-b72f-40f0afdb55d2', 'items', 'f720eed6-cb7c-45f9-9838-d3c0d8fb9397', 'INSERT', NULL, '{"id": "f720eed6-cb7c-45f9-9838-d3c0d8fb9397", "name": "Patti 3 Hole 270mm GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-015", "size_spec": "3 hole 270mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('31d5ee46-a4db-4800-b5a9-778086767489', 'items', '4e48bdaf-6506-41f6-bbc9-ee492a0d55b4', 'INSERT', NULL, '{"id": "4e48bdaf-6506-41f6-bbc9-ee492a0d55b4", "name": "Patti 3 Hole 270mm MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-016", "size_spec": "3 hole 270mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('53e0036b-21a3-4a14-a9a4-282cb53c5be0', 'items', '3f8fe030-2183-4cea-9490-f14370ccd8a2', 'INSERT', NULL, '{"id": "3f8fe030-2183-4cea-9490-f14370ccd8a2", "name": "Patti 3 Hole 220mm GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-017", "size_spec": "3 hole 220mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5a39bdb1-be70-41d6-88c0-9caf81d98dbf', 'items', 'fb5f264b-1198-41e8-b2e1-7fb9e31d1b77', 'INSERT', NULL, '{"id": "fb5f264b-1198-41e8-b2e1-7fb9e31d1b77", "name": "Patti 3 Hole 220mm MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-018", "size_spec": "3 hole 220mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b4e49e48-8bf1-4a41-9571-7a4ee25c509c', 'items', 'ec730727-3f18-476e-9bfe-1dcb77429b4b', 'INSERT', NULL, '{"id": "ec730727-3f18-476e-9bfe-1dcb77429b4b", "name": "Patti 3 Hole Thin GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-019", "size_spec": "thin", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e5e898d5-fce2-45ba-b04d-53dc99dd7ad3', 'items', 'a8b53478-31d4-4cc3-8fc1-f0aa4faaf9db', 'INSERT', NULL, '{"id": "a8b53478-31d4-4cc3-8fc1-f0aa4faaf9db", "name": "Patti 3 Hole Thin MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-020", "size_spec": "thin", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8dc3fcba-2930-4c9a-82ac-2d0966f7b70a', 'items', 'a0f2dc44-f8dc-486b-b5fd-e93c2abe96c2', 'INSERT', NULL, '{"id": "a0f2dc44-f8dc-486b-b5fd-e93c2abe96c2", "name": "GOD Handle Support Channel 100x50 5.5ft", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-021", "size_spec": "100x50x5.5ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "GOD Channel", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('54423e43-0159-4567-b53a-857f95420b05', 'items', '7f5475ff-041d-47ca-94f3-2d532cb79698', 'INSERT', NULL, '{"id": "7f5475ff-041d-47ca-94f3-2d532cb79698", "name": "GOD Handle Support Channel 75x40 3ft", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-022", "size_spec": "75x40x3ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "GOD Channel", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('56f09373-6bbd-4d88-b761-1268c290a616', 'items', '5e156514-71e3-4d99-91c5-58972d0cbe9c', 'INSERT', NULL, '{"id": "5e156514-71e3-4d99-91c5-58972d0cbe9c", "name": "Guarding Angle 7ft GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-023", "size_spec": "7ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Guarding Angle", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e937edcc-762c-44de-93d5-73030ccfdf06', 'items', 'e7d4bb0f-f04c-4c35-8e7d-c636b7f622b5', 'INSERT', NULL, '{"id": "e7d4bb0f-f04c-4c35-8e7d-c636b7f622b5", "name": "Guarding Angle 7ft MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-024", "size_spec": "7ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Guarding Angle", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f15cff9b-c5db-4132-bf38-2005ebc07418', 'items', 'aaa0b2f4-7a8b-41f9-a154-3c82c0885c66', 'INSERT', NULL, '{"id": "aaa0b2f4-7a8b-41f9-a154-3c82c0885c66", "name": "Guarding Angle 5ft GI", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-025", "size_spec": "5ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Guarding Angle", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('ec4d6849-bb8a-47ae-898b-fc2da216dc8d', 'items', 'fd4c0ef3-cc33-4b7c-b25a-5e9af3128697', 'INSERT', NULL, '{"id": "fd4c0ef3-cc33-4b7c-b25a-5e9af3128697", "name": "Guarding Angle 5ft MS", "unit": "No.", "notes": null, "category": "Structural", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STR-026", "size_spec": "5ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Guarding Angle", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f066a34e-2394-40fb-a6e2-aab0ffc7a510', 'items', 'eb65f87c-ee23-4e42-b049-ff03981fe327', 'INSERT', NULL, '{"id": "eb65f87c-ee23-4e42-b049-ff03981fe327", "name": "Cross Arm Clamp 6x6 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-001", "size_spec": "6x6", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Cross Arm", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('cfe4e8b6-9c9a-4609-a855-cab1daf24c92', 'items', '45276e01-4f64-4e6c-8a4d-f5db3e685ad0', 'INSERT', NULL, '{"id": "45276e01-4f64-4e6c-8a4d-f5db3e685ad0", "name": "Cross Arm Clamp 6x6 MS", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-002", "size_spec": "6x6", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Cross Arm", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9f76d752-34d1-456d-8845-38cf6a0fc62b', 'items', 'd374feb8-7efc-4c30-bb81-eaacab52c9e2', 'INSERT', NULL, '{"id": "d374feb8-7efc-4c30-bb81-eaacab52c9e2", "name": "Stay Clamp 6x6 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-003", "size_spec": "6x6", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1d629393-caf0-462b-a3ac-9ee30296c773', 'items', '90084680-a7d9-455b-ae9b-75bf62ba77e7', 'INSERT', NULL, '{"id": "90084680-a7d9-455b-ae9b-75bf62ba77e7", "name": "Stay Clamp 6x6 MS", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-004", "size_spec": "6x6", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9835de56-2d88-4d28-a60f-93854546375f', 'items', '797d7ff5-2ab0-4eb2-af1b-88ded9bd7040', 'INSERT', NULL, '{"id": "797d7ff5-2ab0-4eb2-af1b-88ded9bd7040", "name": "Cross Arm Clamp C&D 4x4.5 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-005", "size_spec": "4x4.5 C&D", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Cross Arm", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e4a6cabb-79e2-4c45-b8f3-00f226a4832b', 'items', 'efe05e9d-9117-49ed-8d17-37a9fee2e5d5', 'INSERT', NULL, '{"id": "efe05e9d-9117-49ed-8d17-37a9fee2e5d5", "name": "Cross Arm Clamp C&D 4x4.5 MS", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-006", "size_spec": "4x4.5 C&D", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Cross Arm", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('23fef142-3884-4dda-9579-a18867c19fbd', 'items', '03efb5f8-d5ff-4dc0-816e-7f6336641a0f', 'INSERT', NULL, '{"id": "03efb5f8-d5ff-4dc0-816e-7f6336641a0f", "name": "Stay Clamp C&D 4x4.5 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-007", "size_spec": "4x4.5 C&D", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('61a7b28f-8f4c-44c4-a94c-ee340117eb75', 'items', 'd2953161-33a3-43a1-ba2f-ffa462e01594', 'INSERT', NULL, '{"id": "d2953161-33a3-43a1-ba2f-ffa462e01594", "name": "Stay Clamp C&D 4x4.5 MS", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-008", "size_spec": "4x4.5 C&D", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('32d6ea3b-803d-4cd2-b240-ad3430c8e57e', 'items', '9c21998f-d0ce-42b8-a110-c9350cc22eaa', 'INSERT', NULL, '{"id": "9c21998f-d0ce-42b8-a110-c9350cc22eaa", "name": "Cross Arm Clamp Long Axis C 5x3 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-009", "size_spec": "5x3 long axis C", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Cross Arm", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('23abdc60-85c7-4344-8ba3-91f0c219152f', 'items', 'fc06a044-78a8-40c3-96d2-75a0f6ab88f4', 'INSERT', NULL, '{"id": "fc06a044-78a8-40c3-96d2-75a0f6ab88f4", "name": "Cross Arm Clamp Long Axis D 5x3 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-010", "size_spec": "5x3 long axis D", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Cross Arm", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('2387626d-6639-4360-9594-5640b345548d', 'items', '0e669017-d1cf-4374-a9d9-494ad394c44f', 'INSERT', NULL, '{"id": "0e669017-d1cf-4374-a9d9-494ad394c44f", "name": "Stay Clamp C&D 5x3 GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-011", "size_spec": "5x3", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('76e4ff4a-d709-4f54-ad17-779e32ed6a9b', 'items', 'eb95d0e8-7d12-4570-9af4-98212a15e013', 'INSERT', NULL, '{"id": "eb95d0e8-7d12-4570-9af4-98212a15e013", "name": "Stay Clamp C&D 5x3 MS", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-012", "size_spec": "5x3", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9636feb4-66f2-47fb-a8e1-0ca64e1b3b69', 'items', '15eb92bd-581a-4a29-8909-a3d084eefec7', 'INSERT', NULL, '{"id": "15eb92bd-581a-4a29-8909-a3d084eefec7", "name": "PSC Pole Clamp C Long Axis GI", "unit": "Pair", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-013", "size_spec": "long axis C", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "PSC Pole", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a2966c38-25d2-4abb-82ee-860e6c695d27', 'items', '4a07bf6a-b331-443b-b64e-c9920eee413d', 'INSERT', NULL, '{"id": "4a07bf6a-b331-443b-b64e-c9920eee413d", "name": "PSC Pole Clamp D Short Axis GI", "unit": "Pair", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-014", "size_spec": "short axis D", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "PSC Pole", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0482e8ab-96b2-4140-b27a-2fab9b45d0e9', 'items', '4fad28e5-17b9-4fe9-86a0-498e0be7b764', 'INSERT', NULL, '{"id": "4fad28e5-17b9-4fe9-86a0-498e0be7b764", "name": "Rail Pole Clamp GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-015", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Rail", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('28535fb0-e97d-42e9-ac94-e20b2d54a540', 'items', '061ab53c-267a-4cf6-8a37-4ae97aafec60', 'INSERT', NULL, '{"id": "061ab53c-267a-4cf6-8a37-4ae97aafec60", "name": "Fiber Clamp 95sqmm", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "8515", "is_active": true, "is_traded": true, "item_code": "CLM-016", "size_spec": "95sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Fiber", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('abdf4cc0-d325-4805-8276-f451fe838d32', 'items', 'f10ffb12-ed61-4596-8ac5-3c7e4b90ee31', 'INSERT', NULL, '{"id": "f10ffb12-ed61-4596-8ac5-3c7e4b90ee31", "name": "Fiber Clamp 300sqmm", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "8515", "is_active": true, "is_traded": true, "item_code": "CLM-017", "size_spec": "300sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Fiber", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('948bf428-c0a2-4140-aabe-699913132681', 'items', '5aa2d589-4488-4020-afb5-820465cf42c9', 'INSERT', NULL, '{"id": "5aa2d589-4488-4020-afb5-820465cf42c9", "name": "D Clamp LT GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-018", "size_spec": "LT", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "D Clamp", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3f3cf337-3177-435e-997e-98258686c7d1', 'items', 'ab7cf539-db3a-4c67-a897-fde379077152', 'INSERT', NULL, '{"id": "ab7cf539-db3a-4c67-a897-fde379077152", "name": "PG Clamp", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "8538", "is_active": true, "is_traded": true, "item_code": "CLM-019", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "PG", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8135fffb-5a58-49ad-b5cc-c2a7303884c7', 'items', 'ed52ce58-112b-4300-8de5-222bdd2192d8', 'INSERT', NULL, '{"id": "ed52ce58-112b-4300-8de5-222bdd2192d8", "name": "V Cross Arm 22KV GI", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-020", "size_spec": "22KV 100x50", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "V Cross Arm", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('962324f9-e53d-40f7-be85-9edf2b9934ac', 'items', '7379f855-6163-4d27-8d1d-17348371ec2d', 'INSERT', NULL, '{"id": "7379f855-6163-4d27-8d1d-17348371ec2d", "name": "V Cross Arm 22KV MS", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-021", "size_spec": "22KV 100x50", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "V Cross Arm", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4b704493-760a-41d2-b5c9-7f394460fe37', 'items', '7149c2bc-b1ee-48a7-a67c-3d686f8e896f', 'INSERT', NULL, '{"id": "7149c2bc-b1ee-48a7-a67c-3d686f8e896f", "name": "V Cross Arm 11KV", "unit": "No.", "notes": null, "category": "Clamp", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "CLM-022", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "V Cross Arm", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('70546a9b-bd3b-4e9b-9ce1-66a13e87d8e2', 'items', '413303c0-7bca-4d8f-b5c1-fecadb635b9f', 'INSERT', NULL, '{"id": "413303c0-7bca-4d8f-b5c1-fecadb635b9f", "name": "HT Stay Set Complete", "unit": "Set", "notes": null, "category": "Stay Set", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "STS-001", "size_spec": "20mm rod set", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5f6f2eac-0646-4f82-b28b-28de0834c8ac', 'items', 'c6bd2016-af8c-4950-b1e8-b5cb1c245839', 'INSERT', NULL, '{"id": "c6bd2016-af8c-4950-b1e8-b5cb1c245839", "name": "HT Stay Set Rod", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-002", "size_spec": "rod", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3ca5d066-bfc2-4b3e-9649-5098f5479033', 'items', '23888b4b-cad7-4b63-9deb-ead9aaf702fa', 'INSERT', NULL, '{"id": "23888b4b-cad7-4b63-9deb-ead9aaf702fa", "name": "HT Stay Set I-bolt", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-003", "size_spec": "i-bolt", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('6d494a8f-b9c3-4d5d-b9cd-6ee30c0f14cf', 'items', 'ad7fefdb-7a08-4f04-bdbd-38bfd72ec3de', 'INSERT', NULL, '{"id": "ad7fefdb-7a08-4f04-bdbd-38bfd72ec3de", "name": "HT Stay Set Turnbuckle", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7208", "is_active": true, "is_traded": true, "item_code": "STS-004", "size_spec": "turnbuckle", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7d758c60-9afc-4c7a-b326-5f17d8f5752b', 'items', 'd5a3e7e1-f04f-4070-a4a0-284be2358351', 'INSERT', NULL, '{"id": "d5a3e7e1-f04f-4070-a4a0-284be2358351", "name": "HT Stay Set Plate", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-005", "size_spec": "plate", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "HT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1522946c-7c4a-4be3-82f0-9e727287ba32', 'items', '253e1571-7b3d-4155-aad5-6b869268d458', 'INSERT', NULL, '{"id": "253e1571-7b3d-4155-aad5-6b869268d458", "name": "LT Stay Set Complete", "unit": "Set", "notes": null, "category": "Stay Set", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "STS-006", "size_spec": "16mm rod set", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('714d66e0-8de0-409d-a829-ffd083f90929', 'items', '9938034f-097d-4cab-b87c-d3f3759ef900', 'INSERT', NULL, '{"id": "9938034f-097d-4cab-b87c-d3f3759ef900", "name": "LT Stay Set Rod", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-007", "size_spec": "rod", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('d7195cb3-b5aa-49cb-96ee-ba73bc9bb124', 'items', '2bba6a7d-caa7-4c9b-9159-21744354f0a7', 'INSERT', NULL, '{"id": "2bba6a7d-caa7-4c9b-9159-21744354f0a7", "name": "LT Stay Set I-bolt", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-008", "size_spec": "i-bolt", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('62951960-5fb9-4a82-8235-dc24c2e8a921', 'items', '0f2ca16e-3b23-4167-b7e7-83a152e59cbf', 'INSERT', NULL, '{"id": "0f2ca16e-3b23-4167-b7e7-83a152e59cbf", "name": "LT Stay Set Turnbuckle", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-009", "size_spec": "turnbuckle", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('2c3d173f-1c19-4cf2-b567-ba13469be356', 'items', 'aa800ead-eae6-4472-8ab0-6d108750eb96', 'INSERT', NULL, '{"id": "aa800ead-eae6-4472-8ab0-6d108750eb96", "name": "LT Stay Set Plate", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7208", "is_active": true, "is_traded": true, "item_code": "STS-010", "size_spec": "plate", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "LT Component", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('ac88a09c-0550-4619-8449-c0c138892ab7', 'items', 'b12152e1-bd59-40ba-a386-3b18d27e726b', 'INSERT', NULL, '{"id": "b12152e1-bd59-40ba-a386-3b18d27e726b", "name": "U Bolt 16mm", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-011", "size_spec": "16mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "U Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('c18800e7-527d-42fa-bed8-210ccc18f9c0', 'items', '6aae197f-6557-4d82-b913-4f5c9a34edbd', 'INSERT', NULL, '{"id": "6aae197f-6557-4d82-b913-4f5c9a34edbd", "name": "Plate Frame 1x1ft", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-012", "size_spec": "1x1 ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Plate Frame", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('225cae0c-a911-4a3a-8848-af66ec9bc255', 'items', '09009ce1-e9dc-4932-ae7c-e762de947e4e', 'INSERT', NULL, '{"id": "09009ce1-e9dc-4932-ae7c-e762de947e4e", "name": "Plate Frame 17x17in", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-013", "size_spec": "17x17 in", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Plate Frame", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('29ce68b6-2b58-443d-80c9-ec3f93923001', 'items', '57730208-1dbe-4cd6-9c9e-3aeaef42611b', 'INSERT', NULL, '{"id": "57730208-1dbe-4cd6-9c9e-3aeaef42611b", "name": "Plate Frame 22x22in", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-014", "size_spec": "22x22 in", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Plate Frame", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('d5959636-13db-46c7-a2cc-813d84004b96', 'items', '806beb57-119f-4438-a74c-3ed488da1d87', 'INSERT', NULL, '{"id": "806beb57-119f-4438-a74c-3ed488da1d87", "name": "Bracket LT 6mm Angle", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-015", "size_spec": "2+4+2ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Bracket", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('acee498e-3e23-4e1f-8769-0d8456cf8c42', 'items', 'ac25fc96-103d-4507-a452-6b234317b9af', 'INSERT', NULL, '{"id": "ac25fc96-103d-4507-a452-6b234317b9af", "name": "Bracket LT 5mm Angle", "unit": "No.", "notes": null, "category": "Stay Set", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "STS-016", "size_spec": "2+4+2ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Bracket", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0460c3ec-80fa-4335-87dc-5776d96112d6', 'items', '7a15d802-70bb-4f1b-b927-6a2d5257b3f8', 'INSERT', NULL, '{"id": "7a15d802-70bb-4f1b-b927-6a2d5257b3f8", "name": "T/F Belt Set Short GI", "unit": "Set", "notes": null, "category": "TF Belt", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "TFB-001", "size_spec": "short", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Short", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('410d177f-c7c3-4430-8a51-f5cd782814e3', 'items', '53558512-e7bd-4b74-b667-8b4a4fe03cb9', 'INSERT', NULL, '{"id": "53558512-e7bd-4b74-b667-8b4a4fe03cb9", "name": "T/F Belt Set Short MS", "unit": "Set", "notes": null, "category": "TF Belt", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "TFB-002", "size_spec": "short", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Short", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('77bbbc10-8e34-4cf5-bf9c-61df43b53617', 'items', '7d22f5b6-6bc8-453e-8b33-a62cdfbfe5d2', 'INSERT', NULL, '{"id": "7d22f5b6-6bc8-453e-8b33-a62cdfbfe5d2", "name": "T/F Belt Long GI", "unit": "No.", "notes": null, "category": "TF Belt", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "TFB-003", "size_spec": "long", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Long", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('43f6a457-5573-460f-a3a6-318dcbb53b20', 'items', '7c239709-4bbc-4979-a9eb-9e730d4652b9', 'INSERT', NULL, '{"id": "7c239709-4bbc-4979-a9eb-9e730d4652b9", "name": "Transformer Belt 2+2 GI", "unit": "Set", "notes": null, "category": "TF Belt", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "TFB-004", "size_spec": "11+11+2+2ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Full Set", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8508a79b-a51f-4dae-8b86-66c5d06c59de', 'items', '4eddfcf9-2e13-48e6-ac03-0a0c4848b206', 'INSERT', NULL, '{"id": "4eddfcf9-2e13-48e6-ac03-0a0c4848b206", "name": "Transformer Belt 2+2 MS", "unit": "Set", "notes": null, "category": "TF Belt", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "TFB-005", "size_spec": "11+11+2+2ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Full Set", "material_type": "MS", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('aab822e8-1f06-49ef-86ef-300f1532900a', 'items', '0a6fe9e1-5c19-4110-90ac-7f8f251d2498', 'INSERT', NULL, '{"id": "0a6fe9e1-5c19-4110-90ac-7f8f251d2498", "name": "Tension Hardware Fitting 3 Bolt", "unit": "No.", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-001", "size_spec": "3 bolt 340wt", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Tension", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('315e9b64-1f7b-4c94-8bf3-6a8167a3a1d9', 'items', '0e505bc4-e312-4ece-b310-1f7779699961', 'INSERT', NULL, '{"id": "0e505bc4-e312-4ece-b310-1f7779699961", "name": "Tension Hardware Fitting 2 Bolt", "unit": "No.", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-002", "size_spec": "2 bolt 275wt", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Tension", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('58dded7c-3a42-4774-96b9-43eb770314fd', 'items', 'b2ca9186-2f22-40f4-95ce-47cc96167c53', 'INSERT', NULL, '{"id": "b2ca9186-2f22-40f4-95ce-47cc96167c53", "name": "Suspension Hardware Set", "unit": "No.", "notes": null, "category": "Hardware", "hsn_code": "7409", "is_active": true, "is_traded": true, "item_code": "HW-003", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Suspension", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e2e9669c-2669-425a-b462-5edfb5dc03e3', 'items', 'baf67f4d-3aa3-4b35-81ec-cedc7cdf327b', 'INSERT', NULL, '{"id": "baf67f4d-3aa3-4b35-81ec-cedc7cdf327b", "name": "CutPoint Set Porcelain", "unit": "Set", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-004", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "CutPoint", "material_type": "Porcelain", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('ef025bf7-0a01-4da7-bef6-f98f9ad08374', 'items', 'cdf012c9-ebb2-4942-91f5-4e6a5272bb97', 'INSERT', NULL, '{"id": "cdf012c9-ebb2-4942-91f5-4e6a5272bb97", "name": "CutPoint Set Polymer 22KV", "unit": "Set", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-005", "size_spec": "22KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "CutPoint", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f4e61d69-6c03-479a-b0b1-f2e39cae9d1e', 'items', 'fe76c197-de50-47b0-bada-f4dfc8ab72ef', 'INSERT', NULL, '{"id": "fe76c197-de50-47b0-bada-f4dfc8ab72ef", "name": "CutPoint Set 11KV", "unit": "Set", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-006", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "CutPoint", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('89fedb6f-4df4-4f26-87a6-354039f8f563', 'items', '29654471-bdf0-4a21-98b3-e139f8d1eb3c', 'INSERT', NULL, '{"id": "29654471-bdf0-4a21-98b3-e139f8d1eb3c", "name": "Horn Gap Set Porcelain", "unit": "Set", "notes": null, "category": "Hardware", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "HW-007", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Horn Gap", "material_type": "Porcelain", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1bdd15a3-ef03-4f88-a9b4-c4b2e4ff4127', 'items', 'b449e4f7-98b6-4dfe-a24f-d940c287b364', 'INSERT', NULL, '{"id": "b449e4f7-98b6-4dfe-a24f-d940c287b364", "name": "Horn Gap Set Polymer 22KV", "unit": "Set", "notes": null, "category": "Hardware", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "HW-008", "size_spec": "22KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Horn Gap", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f059a4dd-e063-4581-b777-cd43a004343b', 'items', '2169cdf2-b031-4aa1-99de-63fd00dfd0b6', 'INSERT', NULL, '{"id": "2169cdf2-b031-4aa1-99de-63fd00dfd0b6", "name": "Top Fitting Vertical", "unit": "No.", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-009", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Top Fitting", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('d64b037f-d2d7-4a12-bc15-0bae8da3c0cc', 'items', 'c7a2cedc-3a1a-4e5d-a3b3-61a91c771111', 'INSERT', NULL, '{"id": "c7a2cedc-3a1a-4e5d-a3b3-61a91c771111", "name": "Top Fitting 11KV", "unit": "No.", "notes": null, "category": "Hardware", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "HW-010", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Top Fitting", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3e29ef19-04c0-43f5-9951-28ba4e0e06ac', 'items', '842d081a-5a61-47a6-a12d-4a6d67af4813', 'INSERT', NULL, '{"id": "842d081a-5a61-47a6-a12d-4a6d67af4813", "name": "G.O.D. Set 22KV 200A/400A", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "GOD-001", "size_spec": "22KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Complete Set", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('338e462c-d709-48c3-98d3-ed8f40c1a0c9', 'items', 'eb647540-904f-4353-9255-ed76961d0878', 'INSERT', NULL, '{"id": "eb647540-904f-4353-9255-ed76961d0878", "name": "G.O.D. Set 11KV", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "GOD-002", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Complete Set", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b4ec16e7-f945-450c-aad8-bd3acfe5f0e7', 'items', '2600b043-d81b-4680-9da4-ba2381be310d', 'INSERT', NULL, '{"id": "2600b043-d81b-4680-9da4-ba2381be310d", "name": "D.O. Set 22KV", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "GOD-003", "size_spec": "22KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "DO Set", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('94901f4a-8698-4247-8bfc-78ff1328a0a9', 'items', '1a36fa6f-b898-4fae-9ad5-2b6b7f87418a', 'INSERT', NULL, '{"id": "1a36fa6f-b898-4fae-9ad5-2b6b7f87418a", "name": "D.O. Set 11KV", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "GOD-004", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "DO Set", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('145c27b8-34f0-42c3-a37e-01cf6cd1ea7a', 'items', '67d7d4e1-9ecd-457a-8d31-59ea54ca0c28', 'INSERT', NULL, '{"id": "67d7d4e1-9ecd-457a-8d31-59ea54ca0c28", "name": "Single Piece GOD", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "GOD-005", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Single", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b8e1ea4b-46d4-49e3-8717-7910c0b914d0', 'items', 'cb1a6374-f2e2-47e3-abc6-7dd8a65d42f2', 'INSERT', NULL, '{"id": "cb1a6374-f2e2-47e3-abc6-7dd8a65d42f2", "name": "GOD Pipe", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "8307", "is_active": true, "is_traded": true, "item_code": "GOD-006", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('eaf804fd-6467-4c54-9bf0-604c64eac491', 'items', '3d1d4df1-e762-4aaa-bd1d-f4d9dfd3d328', 'INSERT', NULL, '{"id": "3d1d4df1-e762-4aaa-bd1d-f4d9dfd3d328", "name": "GOD Rod Light wt 1.75kg", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "8307", "is_active": true, "is_traded": true, "item_code": "GOD-007", "size_spec": "light wt 1.75kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b23484f7-fb13-4922-aec0-683fc8b811ba', 'items', 'dacb6d04-5686-4949-9837-82d718a76f4c', 'INSERT', NULL, '{"id": "dacb6d04-5686-4949-9837-82d718a76f4c", "name": "GOD Rod Heavy wt 11.35kg", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "8307", "is_active": true, "is_traded": true, "item_code": "GOD-008", "size_spec": "heavy wt 11.35kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3ee66387-05e2-411f-9e98-ef45ced35dfe', 'items', 'c5a6d1ae-5bde-4c4b-b5b3-85fe5248d999', 'INSERT', NULL, '{"id": "c5a6d1ae-5bde-4c4b-b5b3-85fe5248d999", "name": "GOD Lever", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "8307", "is_active": true, "is_traded": true, "item_code": "GOD-009", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('16ac06e6-c18d-4074-bcae-6af4f0046969', 'items', 'f84ae56f-7d1e-42b0-9a8c-856ae3014924', 'INSERT', NULL, '{"id": "f84ae56f-7d1e-42b0-9a8c-856ae3014924", "name": "GOD Handle", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "GOD-010", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('bc8284e1-1a98-4b2d-a3a9-22d3c2ed463c', 'items', '80dd318f-6868-435b-a651-c64d479a7847', 'INSERT', NULL, '{"id": "80dd318f-6868-435b-a651-c64d479a7847", "name": "GOD Contact Set", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "GOD-011", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('90004a06-bc36-4387-8a30-b34623f5b016', 'items', '982767f3-5937-4063-bc31-e9e934fc91df', 'INSERT', NULL, '{"id": "982767f3-5937-4063-bc31-e9e934fc91df", "name": "GOD Copper Belt Braided 25x2mm", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "GOD-012", "size_spec": "25x2mm braided", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Copper", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0d67e5f7-b57d-4808-80a7-7444da415710', 'items', '00014870-0a07-42b8-a4a1-ca570652114e', 'INSERT', NULL, '{"id": "00014870-0a07-42b8-a4a1-ca570652114e", "name": "GOD Copper Patti 40x5mm", "unit": "Kg", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "GOD-013", "size_spec": "40x5mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Copper", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9e7e4dc8-efd5-420f-ae02-1b7b3810e851', 'items', '846d47d1-6e67-40bc-b36b-ad231c5849ba', 'INSERT', NULL, '{"id": "846d47d1-6e67-40bc-b36b-ad231c5849ba", "name": "GOD Copper Contact", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "GOD-014", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Copper", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4982a997-d893-447c-ae36-00245c538ea9', 'items', 'a39deff0-ee90-4162-a035-ee223fe676cf', 'INSERT', NULL, '{"id": "a39deff0-ee90-4162-a035-ee223fe676cf", "name": "GOD Padistor", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "GOD-015", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('cbdf2d35-9032-49ca-bbb7-ed916eab271d', 'items', 'f302b498-88f2-46d4-b1e9-69483fd16ae1', 'INSERT', NULL, '{"id": "f302b498-88f2-46d4-b1e9-69483fd16ae1", "name": "GOD Spring", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "GOD-016", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('d0ae509c-7930-49fc-b95d-5a76ffb00f76', 'items', '7c62554d-9e7f-480c-b8ab-a0cbf867bcae', 'INSERT', NULL, '{"id": "7c62554d-9e7f-480c-b8ab-a0cbf867bcae", "name": "GOD Rivet", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "GOD-017", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('727cd6c6-cb19-4ebb-8716-1d8af81bd60b', 'items', 'c2e148ec-6517-44e2-9116-f5d31a3e4a8b', 'INSERT', NULL, '{"id": "c2e148ec-6517-44e2-9116-f5d31a3e4a8b", "name": "Horn Gap Contact Ring Set", "unit": "Set", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "GOD-018", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Part", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('11963f7c-46aa-4f00-be53-6bd5cc590048', 'items', 'a6816dbe-c071-4abc-b371-5dd304635859', 'INSERT', NULL, '{"id": "a6816dbe-c071-4abc-b371-5dd304635859", "name": "D.O. Horn Gap Polymer", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "GOD-019", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "DO Part", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8fc25c50-7d36-4404-9a4c-21a294fc3d12', 'items', 'c31b634a-3d4b-4aec-b59d-1bda08074f68', 'INSERT', NULL, '{"id": "c31b634a-3d4b-4aec-b59d-1bda08074f68", "name": "D.O. Horn Gap Porcelain", "unit": "No.", "notes": null, "category": "GOD", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "GOD-020", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "DO Part", "material_type": "Porcelain", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5901c886-bb53-4f3c-ae07-d80636bb9d94', 'items', '9c8d9341-4b82-4792-8fe7-12c76a96246c', 'INSERT', NULL, '{"id": "9c8d9341-4b82-4792-8fe7-12c76a96246c", "name": "L.A. Set 22KV", "unit": "Set", "notes": null, "category": "LA", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "LA-001", "size_spec": "22KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Complete", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('23b7259c-7d66-4900-b02c-580f4917cc22', 'items', 'f83f78a8-3d80-4be6-8775-fd883ad269a7', 'INSERT', NULL, '{"id": "f83f78a8-3d80-4be6-8775-fd883ad269a7", "name": "L.A. Set 11KV", "unit": "Set", "notes": null, "category": "LA", "hsn_code": "8535", "is_active": true, "is_traded": true, "item_code": "LA-002", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Complete", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('eafbacb4-69f6-47a3-b9d3-37bea099bf03', 'items', 'd1835b2b-3e70-4219-959e-226102e113fb', 'INSERT', NULL, '{"id": "d1835b2b-3e70-4219-959e-226102e113fb", "name": "Nut Bolt M16x75 5/8x3in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-001", "size_spec": "M16x75 0.2kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('fc6b9813-1d31-438a-b85e-b09dc737cad9', 'items', '85099472-7110-477c-86ac-c74d527f005f', 'INSERT', NULL, '{"id": "85099472-7110-477c-86ac-c74d527f005f", "name": "Nut Bolt M16x100 5/8x4in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-002", "size_spec": "M16x100 0.25kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a9e6cc87-2079-4d77-a6a5-bafe3053d5e6', 'items', '7aba8d4c-3f1d-4405-9666-22b7a40c59ee', 'INSERT', NULL, '{"id": "7aba8d4c-3f1d-4405-9666-22b7a40c59ee", "name": "Nut Bolt M16x150 5/8x6in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-003", "size_spec": "M16x150 0.3kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f0a1730a-eae7-411b-8c9f-c85d6f7d3142', 'items', 'c5dc55b5-28ad-46e4-9e94-9c1073429f64', 'INSERT', NULL, '{"id": "c5dc55b5-28ad-46e4-9e94-9c1073429f64", "name": "Nut Bolt M16x200 5/8x8in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-004", "size_spec": "M16x200 0.4kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4311c313-78c3-4ca7-8596-ede24725bada', 'items', '4fe12233-95aa-422c-a436-7c6d1ee6910e', 'INSERT', NULL, '{"id": "4fe12233-95aa-422c-a436-7c6d1ee6910e", "name": "Nut Bolt M12x75 1/2x3in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-005", "size_spec": "M12x75 0.125kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3012f3e0-7cda-4571-a22b-478f37d6a78f', 'items', 'd3b07e90-58ef-46a5-8633-c65dd10c8d7a', 'INSERT', NULL, '{"id": "d3b07e90-58ef-46a5-8633-c65dd10c8d7a", "name": "Nut Bolt M12x125 1/2x6in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-006", "size_spec": "M12x125 0.175kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('99eaa69d-38df-4a67-8178-3770fa5e6faa', 'items', '303e10ab-000e-47d3-9bd0-d99af52557bf', 'INSERT', NULL, '{"id": "303e10ab-000e-47d3-9bd0-d99af52557bf", "name": "Nut Bolt M12x40 1/2x1.5in", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-007", "size_spec": "M12x40 0.1kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Nut Bolt", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('051811d5-2e25-4544-bd20-17a8bec25a90', 'items', '9976fbe8-88ff-4262-afae-16b8fb41c42e', 'INSERT', NULL, '{"id": "9976fbe8-88ff-4262-afae-16b8fb41c42e", "name": "Shackle Nut Bolt GI", "unit": "Kg", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-008", "size_spec": "1kg=12no", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Shackle NB", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('169fb7f8-9094-40c6-bf93-f0c9f88ebbb8', 'items', 'ffc5dbf7-0e53-4fb8-99fb-666a123b7fa5', 'INSERT', NULL, '{"id": "ffc5dbf7-0e53-4fb8-99fb-666a123b7fa5", "name": "Shackle Patti GI", "unit": "Kg", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-009", "size_spec": "1kg=16no", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Shackle Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a882d003-944e-43c0-a277-be0792a99054', 'items', '9eaddd9a-602d-40a4-971e-4a5f437738eb', 'INSERT', NULL, '{"id": "9eaddd9a-602d-40a4-971e-4a5f437738eb", "name": "Earthing Nut Bolt GI", "unit": "Kg", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-010", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Earthing NB", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('2f75f792-d1e7-42ba-a127-d3eb9184d73f', 'items', 'dea8d062-96b9-4170-bf8d-f47a7d30eef0', 'INSERT', NULL, '{"id": "dea8d062-96b9-4170-bf8d-f47a7d30eef0", "name": "GI Wire", "unit": "Kg", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-011", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "GI Wire", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b08df89d-859a-416c-abdd-4930d6a63b70', 'items', '92be5a49-1b39-4ee2-800b-9cc59071901e', 'INSERT', NULL, '{"id": "92be5a49-1b39-4ee2-800b-9cc59071901e", "name": "D.O. Hook", "unit": "No.", "notes": null, "category": "Fastener", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "NB-012", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "DO Hook", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('597281ca-c6dc-4c8d-bae5-257ac05325e4', 'items', '4cbe38a9-0f52-400b-ae65-26a4802dca2e', 'INSERT', NULL, '{"id": "4cbe38a9-0f52-400b-ae65-26a4802dca2e", "name": "Earthing Iron Plate 12x12in", "unit": "No.", "notes": null, "category": "Earthing", "hsn_code": "8438", "is_active": true, "is_traded": true, "item_code": "ERT-001", "size_spec": "300x300mm | 1.9kg (4mm)", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Plate", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9f1ab238-755c-415d-acd2-b1a5bf462c24', 'items', 'a01b0bbf-fafc-46f9-92aa-71ad400e6c62', 'INSERT', NULL, '{"id": "a01b0bbf-fafc-46f9-92aa-71ad400e6c62", "name": "Earthing Iron Plate 17x17in", "unit": "No.", "notes": null, "category": "Earthing", "hsn_code": "8438", "is_active": true, "is_traded": true, "item_code": "ERT-002", "size_spec": "450x450mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Plate", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a1e85873-92e0-400f-bbd1-2243c1c14a6e', 'items', '65fb6759-fb8b-41a3-9374-6c6ece732f0d', 'INSERT', NULL, '{"id": "65fb6759-fb8b-41a3-9374-6c6ece732f0d", "name": "Earthing Iron Plate 22x22in", "unit": "No.", "notes": null, "category": "Earthing", "hsn_code": "8438", "is_active": true, "is_traded": true, "item_code": "ERT-003", "size_spec": "600x600mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Plate", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e7d3489e-7aa3-41a2-889b-1193e4309411', 'items', '1d9508cc-28ff-486b-ae89-76283ae0902c', 'INSERT', NULL, '{"id": "1d9508cc-28ff-486b-ae89-76283ae0902c", "name": "GI Pipe Earthing Without Funnel", "unit": "No.", "notes": null, "category": "Earthing", "hsn_code": "8307", "is_active": true, "is_traded": true, "item_code": "ERT-004", "size_spec": "wt 1.1kg", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pipe", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1f9ad217-34e8-41f6-bdd4-e0bfe1961f3b', 'items', 'da6e0324-96ac-4530-b67f-a1306d344b0c', 'INSERT', NULL, '{"id": "da6e0324-96ac-4530-b67f-a1306d344b0c", "name": "GI Pipe Earthing With Funnel", "unit": "No.", "notes": null, "category": "Earthing", "hsn_code": "8307", "is_active": true, "is_traded": true, "item_code": "ERT-005", "size_spec": "with funnel", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pipe", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('66737213-62ad-4a95-85a3-38c7e18abb56', 'items', '4eb02a69-28af-4ae3-b4d9-36574e24ad94', 'INSERT', NULL, '{"id": "4eb02a69-28af-4ae3-b4d9-36574e24ad94", "name": "Earthing Patti 25x3mm", "unit": "Kg", "notes": null, "category": "Earthing", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "ERT-006", "size_spec": "25x3mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8ce0c055-e742-415f-8e0e-172929d69698', 'items', '3d3ede72-4937-43a4-b712-b47551d55725', 'INSERT', NULL, '{"id": "3d3ede72-4937-43a4-b712-b47551d55725", "name": "Earthing Patti 50x6mm", "unit": "Kg", "notes": null, "category": "Earthing", "hsn_code": "7308", "is_active": true, "is_traded": true, "item_code": "ERT-007", "size_spec": "50x6mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5e99a751-1de3-4324-8b97-a138a48656ca', 'items', '10943968-c540-44a8-9709-64a075af70c4', 'INSERT', NULL, '{"id": "10943968-c540-44a8-9709-64a075af70c4", "name": "Earthing Betnater Powder", "unit": "Kg", "notes": null, "category": "Earthing", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ERT-008", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Powder", "material_type": "Chemical", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5ad49c22-2cd4-4a02-94de-883fa1869310', 'items', 'd76cc405-4426-4506-a7e9-6c330ba93337', 'INSERT', NULL, '{"id": "d76cc405-4426-4506-a7e9-6c330ba93337", "name": "Earthing Chamber Cover 1x1ft", "unit": "No.", "notes": null, "category": "Earthing", "hsn_code": "7326", "is_active": true, "is_traded": true, "item_code": "ERT-009", "size_spec": "1x1ft", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Chamber", "material_type": "Concrete", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7fc424ea-c3d3-4250-b91c-134e84a724ed', 'items', '5ed01e77-987f-4a4d-b7b9-6d982b6936b3', 'INSERT', NULL, '{"id": "5ed01e77-987f-4a4d-b7b9-6d982b6936b3", "name": "Earthing Copper Patti 25x3mm", "unit": "Kg", "notes": null, "category": "Earthing", "hsn_code": "", "is_active": true, "is_traded": false, "item_code": "ERT-010", "size_spec": "25x3mm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Patti", "material_type": "Copper", "reorder_level": 0.00, "is_manufactured": true, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('a5ff2770-be85-4d64-a278-d7a6b173dded', 'items', '708fa213-046c-4c07-8262-e4c35885f4f2', 'INSERT', NULL, '{"id": "708fa213-046c-4c07-8262-e4c35885f4f2", "name": "Distribution Box 100KV Single CKT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-001", "size_spec": "100KV Single", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Single", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('68966281-305a-4955-974a-808faa299fb2', 'items', '0e11e4fc-0009-4c92-b5e4-2995815fdafb', 'INSERT', NULL, '{"id": "0e11e4fc-0009-4c92-b5e4-2995815fdafb", "name": "Distribution Box 100KV Double CKT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-002", "size_spec": "100KV Double", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Double", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('c5c73c39-c49a-4008-b238-907c5fef5d66', 'items', 'b67b1e82-7a64-493a-bfe1-76a0200f2555', 'INSERT', NULL, '{"id": "b67b1e82-7a64-493a-bfe1-76a0200f2555", "name": "Distribution Box 150KV Single CKT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-003", "size_spec": "150KV Single", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Single", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('bdf1adf4-7e5e-4bfa-9752-b4c0603dab1e', 'items', '7beff6ab-94f1-4c1b-92de-e7037ffea447', 'INSERT', NULL, '{"id": "7beff6ab-94f1-4c1b-92de-e7037ffea447", "name": "Distribution Box 150KV Double CKT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-004", "size_spec": "150KV Double", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Double", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('3580b18c-2d95-465c-a46e-bdbff2b0a943', 'items', 'c63b30c8-7184-440f-ac86-64a3ab385171', 'INSERT', NULL, '{"id": "c63b30c8-7184-440f-ac86-64a3ab385171", "name": "Distribution Box 200KV Single CKT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-005", "size_spec": "200KV Single", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Single", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('c0e40da8-2c66-4c8b-93f5-3fa523a94339', 'items', '54f02152-2a7b-4cdb-937d-3ee19416e942', 'INSERT', NULL, '{"id": "54f02152-2a7b-4cdb-937d-3ee19416e942", "name": "Distribution Box 200KV Double CKT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-006", "size_spec": "200KV Double", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Double", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1f76112a-96d4-4289-860e-943f2714a524', 'items', 'be4fcbdb-65d1-4f9d-8d81-45cd8ebab927', 'INSERT', NULL, '{"id": "be4fcbdb-65d1-4f9d-8d81-45cd8ebab927", "name": "Distribution Box 150A MCCB Single", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-007", "size_spec": "150A MCCB", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "MCCB", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('775f53ab-893a-485f-8177-c9a98f099a1c', 'items', 'b358759e-4035-4f1c-8827-01810dc25d13', 'INSERT', NULL, '{"id": "b358759e-4035-4f1c-8827-01810dc25d13", "name": "Distribution Box 250A Double", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-008", "size_spec": "250A Double", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Double", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9f2dbc1c-fcb7-4982-b941-a04b4841a30c', 'items', '1512c2fa-1cf2-4dc3-8484-e2be69027cf2', 'INSERT', NULL, '{"id": "1512c2fa-1cf2-4dc3-8484-e2be69027cf2", "name": "Distribution Box 400A MCCB Double", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-009", "size_spec": "400A MCCB", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "MCCB Double", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('49edff7d-7226-414b-985b-97e2ec3744a5', 'items', '344018ed-38b4-4c09-bca4-8b0e8b6a468c', 'INSERT', NULL, '{"id": "344018ed-38b4-4c09-bca4-8b0e8b6a468c", "name": "Mini Pillar Bus Bar", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-010", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Mini Pillar", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('040af44a-b742-4f69-b532-74290572324f', 'items', 'cd5cdba6-eb40-4237-8abe-93b2aa451477', 'INSERT', NULL, '{"id": "cd5cdba6-eb40-4237-8abe-93b2aa451477", "name": "One Way Fuse", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-011", "size_spec": "fuse", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "One Way", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5528ddfb-c3e7-4f20-a439-5610b512160d', 'items', '9536c4ee-3ad8-4bc8-aeba-d546e46c9a96', 'INSERT', NULL, '{"id": "9536c4ee-3ad8-4bc8-aeba-d546e46c9a96", "name": "4 Way Plain", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-012", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "4 Way", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('f48430de-2900-49af-bc74-b09b912e8d47', 'items', '00813bc9-ebdf-4123-abdd-13ddc863a07b', 'INSERT', NULL, '{"id": "00813bc9-ebdf-4123-abdd-13ddc863a07b", "name": "4 Way Feeder Pillar 250 MCCB", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-013", "size_spec": "250 MCCB", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Feeder Pillar", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0ab369d9-7766-435b-8936-6281ac4742ec', 'items', '8981c7ea-5387-4d8f-bbc7-b1e924c01789', 'INSERT', NULL, '{"id": "8981c7ea-5387-4d8f-bbc7-b1e924c01789", "name": "4 Way Feeder Pillar 600A MCCB DTC Meter", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-014", "size_spec": "600A MCCB+DTC", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Feeder Pillar", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7d213e6c-edfc-4c0a-8e99-45f03a22471b', 'items', '265a046f-0eee-4625-aa5c-a10af66e5b08', 'INSERT', NULL, '{"id": "265a046f-0eee-4625-aa5c-a10af66e5b08", "name": "6 Way Feeder Pillar 800 MCCB", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-015", "size_spec": "800 MCCB", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Feeder Pillar", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('6f0e44a0-bc74-4195-9952-0b4f64987bab', 'items', '3889406f-286b-48ef-9ce3-b9ae76334b9d', 'INSERT', NULL, '{"id": "3889406f-286b-48ef-9ce3-b9ae76334b9d", "name": "DTC Meter 100/5", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "9028", "is_active": true, "is_traded": true, "item_code": "DB-016", "size_spec": "100/5", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Meter", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('509165b0-8080-42e9-a552-11807f4ca2f1', 'items', '16ab7c43-ac10-48b0-a6ae-913d274959b7', 'INSERT', NULL, '{"id": "16ab7c43-ac10-48b0-a6ae-913d274959b7", "name": "200/5 LT CT", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8504", "is_active": true, "is_traded": true, "item_code": "DB-017", "size_spec": "200/5 LT", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "CT", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('ddde4c1c-c49b-4f99-b967-f94fd7542f17', 'items', 'b82c621b-4f35-410c-9d21-95337db6fcae', 'INSERT', NULL, '{"id": "b82c621b-4f35-410c-9d21-95337db6fcae", "name": "HRC Fuse Link", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8536", "is_active": true, "is_traded": true, "item_code": "DB-018", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Fuse", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5d7921c8-e612-4dd4-a2bc-8edcc1498140', 'items', '797a01ca-f5d9-49b6-84f0-df13d8371402', 'INSERT', NULL, '{"id": "797a01ca-f5d9-49b6-84f0-df13d8371402", "name": "GI Coupling", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "7307", "is_active": true, "is_traded": true, "item_code": "DB-019", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Coupling", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('33d8880c-95a4-4fc8-8e96-d7c0277304fc', 'items', 'ec9c1636-95f1-4931-bbfd-0812bfb39d1c', 'INSERT', NULL, '{"id": "ec9c1636-95f1-4931-bbfd-0812bfb39d1c", "name": "Fiber Tube", "unit": "No.", "notes": null, "category": "DB", "hsn_code": "8546", "is_active": true, "is_traded": true, "item_code": "DB-020", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Tube", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('66196cfb-fa5d-4900-8669-2651dbbc39b6', 'items', '9fe73e7a-39b9-4305-9fe5-2f8b2d6cab08', 'INSERT', NULL, '{"id": "9fe73e7a-39b9-4305-9fe5-2f8b2d6cab08", "name": "Aluminium Lug 25sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-001", "size_spec": "25sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('d279ba23-eb88-4ac3-928d-69089b984df7', 'items', '7482a567-38ca-4733-afdb-562306df5e6c', 'INSERT', NULL, '{"id": "7482a567-38ca-4733-afdb-562306df5e6c", "name": "Aluminium Lug 35sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-002", "size_spec": "35sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('b6387fe3-aabe-4d0d-a188-9dd29545db47', 'items', '5e5b115a-edb2-478a-b4c6-65e79ad4b00e', 'INSERT', NULL, '{"id": "5e5b115a-edb2-478a-b4c6-65e79ad4b00e", "name": "Aluminium Lug 50sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-003", "size_spec": "50sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0317ec02-d232-447b-a243-3665955af583', 'items', 'f763a59d-348f-4256-ba80-ddb1c2e4d00b', 'INSERT', NULL, '{"id": "f763a59d-348f-4256-ba80-ddb1c2e4d00b", "name": "Aluminium Lug 70sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-004", "size_spec": "70sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('9bfae6cf-6b57-4e83-b377-8ab6daa7baf1', 'items', '25d4689d-6852-44a5-af63-a42839f69999', 'INSERT', NULL, '{"id": "25d4689d-6852-44a5-af63-a42839f69999", "name": "Aluminium Lug 95sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-005", "size_spec": "95sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('0b699539-3f9c-44ff-bece-0f3ff2d6b562', 'items', '1f3a706c-40b5-4980-8538-80c6e191a9d0', 'INSERT', NULL, '{"id": "1f3a706c-40b5-4980-8538-80c6e191a9d0", "name": "Aluminium Lug 120sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-006", "size_spec": "120sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('5ec0c57b-3ef9-48ef-975f-d58e764738ba', 'items', 'efe23c5a-fa99-41e9-a7c9-cae6d8130188', 'INSERT', NULL, '{"id": "efe23c5a-fa99-41e9-a7c9-cae6d8130188", "name": "Aluminium Lug 150sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-007", "size_spec": "150sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('eb0146be-ba29-455e-8fb9-32a3beb7757c', 'items', '3268f6a9-d998-419a-8dfd-5787cb5b227f', 'INSERT', NULL, '{"id": "3268f6a9-d998-419a-8dfd-5787cb5b227f", "name": "Aluminium Lug 185sqmm", "unit": "No.", "notes": null, "category": "Lug", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "LUG-008", "size_spec": "185sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "AL Lug", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('1b64090f-cc80-41ac-8dce-0b500b41e06a', 'items', 'c6b9c1a8-3847-4746-8a47-75b503309463', 'INSERT', NULL, '{"id": "c6b9c1a8-3847-4746-8a47-75b503309463", "name": "Wedge Connector Rabbit", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-001", "size_spec": "Rabbit", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Wedge Connector", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e1ee300c-a4db-41ee-89ca-6d60e335ceda', 'items', '9f9eedfd-df9e-4f87-ba66-2d188b9265b8', 'INSERT', NULL, '{"id": "9f9eedfd-df9e-4f87-ba66-2d188b9265b8", "name": "Wedge Connector Dog", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-002", "size_spec": "Dog", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Wedge Connector", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('bd445bf3-062a-45c9-8c80-282509316fea', 'items', 'ae2734ab-042e-485d-8a65-030876063d99', 'INSERT', NULL, '{"id": "ae2734ab-042e-485d-8a65-030876063d99", "name": "Line Spacer 1Ph 2Wire", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-003", "size_spec": "1ph 2wire", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Spacer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7e4a2edb-3f1a-4de3-82e5-d9c0f66500f3', 'items', 'b6f8b21b-ec8a-4b28-a64c-8973e51cf87a', 'INSERT', NULL, '{"id": "b6f8b21b-ec8a-4b28-a64c-8973e51cf87a", "name": "Line Spacer 1Ph 3Wire", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-004", "size_spec": "1ph 3wire", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Spacer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e5e2e202-2853-404c-8bbf-0b1562d6a83a', 'items', '8888b02b-76d8-4c7d-adee-a1d587365193', 'INSERT', NULL, '{"id": "8888b02b-76d8-4c7d-adee-a1d587365193", "name": "Line Spacer 3Ph 4Wire", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-005", "size_spec": "3ph 4wire", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Spacer", "material_type": "Polymer", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('7788a107-e929-407e-8b11-843df62de60d', 'items', '00f544b4-f5b0-4592-be63-d35ee44633cd', 'INSERT', NULL, '{"id": "00f544b4-f5b0-4592-be63-d35ee44633cd", "name": "HT Termination Kit 95sqmm 3C", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-006", "size_spec": "3Cx95sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Term Kit", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('8ef95467-bd24-474f-8949-df77b71ce64f', 'items', '3adaa692-69fd-4ae8-9a52-2fbc85bfbe20', 'INSERT', NULL, '{"id": "3adaa692-69fd-4ae8-9a52-2fbc85bfbe20", "name": "HT Termination Kit 185sqmm", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-007", "size_spec": "185sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Term Kit", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('be77647f-ceee-46a3-ab58-758db030f141', 'items', 'b7433b67-30a4-4418-9a6a-b29f6208beb8', 'INSERT', NULL, '{"id": "b7433b67-30a4-4418-9a6a-b29f6208beb8", "name": "HT Termination Kit 300sqmm", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-008", "size_spec": "300sqmm", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Term Kit", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('22dd764f-d762-4f14-a5f8-745593305e6c', 'items', '8643c6b8-801d-4d3b-a1ea-d04b08a9615b', 'INSERT', NULL, '{"id": "8643c6b8-801d-4d3b-a1ea-d04b08a9615b", "name": "Barbad Wire", "unit": "Kg", "notes": null, "category": "Accessories", "hsn_code": "7313", "is_active": true, "is_traded": true, "item_code": "ACC-009", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Wire", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('05bd1ad1-a071-4927-ac04-59e613788baf', 'items', '36fc6f39-4b80-4b7f-89ef-97bb4c82a7db', 'INSERT', NULL, '{"id": "36fc6f39-4b80-4b7f-89ef-97bb4c82a7db", "name": "Stay Wire GI", "unit": "Kg", "notes": null, "category": "Accessories", "hsn_code": "7217", "is_active": true, "is_traded": true, "item_code": "ACC-010", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Stay Wire", "material_type": "GI", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": true}', NULL, '2026-05-16 01:03:33.351499+00'),
	('025b804a-0122-456a-8468-4ab66a7f8b7e', 'items', 'a62300c6-1b07-4990-b74b-c65a4d1c769b', 'INSERT', NULL, '{"id": "a62300c6-1b07-4990-b74b-c65a4d1c769b", "name": "Fuse Wire", "unit": "Kg", "notes": null, "category": "Accessories", "hsn_code": "7408", "is_active": true, "is_traded": true, "item_code": "ACC-011", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Fuse Wire", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('50fb53be-ae1e-42e2-b470-867b20f0fc2f', 'items', '28868702-13c7-4563-8c4a-760620a2e965', 'INSERT', NULL, '{"id": "28868702-13c7-4563-8c4a-760620a2e965", "name": "Alkathene Pipe", "unit": "Mtr", "notes": null, "category": "Accessories", "hsn_code": "", "is_active": true, "is_traded": true, "item_code": "ACC-012", "size_spec": "", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Pipe", "material_type": "HDPE", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('e39978ad-e807-45d6-8601-e212851e6b13', 'items', 'e4c094db-8734-404b-87e7-5814f6e45948', 'INSERT', NULL, '{"id": "e4c094db-8734-404b-87e7-5814f6e45948", "name": "Danger Board 22KV 33KV", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "7313", "is_active": true, "is_traded": true, "item_code": "ACC-013", "size_spec": "22KV/33KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Signage", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('386b6699-fe97-4c96-a09e-eded8c4a8efb', 'items', 'e51ccbf7-a575-4e51-b971-00517aaecec0', 'INSERT', NULL, '{"id": "e51ccbf7-a575-4e51-b971-00517aaecec0", "name": "Danger Board 11KV", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "7313", "is_active": true, "is_traded": true, "item_code": "ACC-014", "size_spec": "11KV", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Signage", "material_type": "Other", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00'),
	('4b250e72-8713-44b0-84f1-fc3bc2eb85d3', 'items', '42375aed-8d23-4020-b07c-b9de9681fb0a', 'INSERT', NULL, '{"id": "42375aed-8d23-4020-b07c-b9de9681fb0a", "name": "Aluminium Bobin LT Line", "unit": "No.", "notes": null, "category": "Accessories", "hsn_code": "4822", "is_active": true, "is_traded": true, "item_code": "ACC-015", "size_spec": "LT", "created_at": "2026-05-16T01:03:33.351499+00:00", "created_by": null, "updated_at": "2026-05-16T01:03:33.351499+00:00", "reorder_qty": 0.00, "sub_category": "Bobin", "material_type": "Aluminium", "reorder_level": 0.00, "is_manufactured": false, "is_raw_material": false}', NULL, '2026-05-16 01:03:33.351499+00');




-- =========================================================================
-- Item category seed
-- =========================================================================

INSERT INTO "public"."item_categories" (
    "org_id",
    "code",
    "name"
)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'CONDUCTOR', 'Conductor'),
    ('00000000-0000-0000-0000-000000000001', 'CABLE', 'Cable'),
    ('00000000-0000-0000-0000-000000000001', 'INSULATOR', 'Insulator'),
    ('00000000-0000-0000-0000-000000000001', 'STRUCTURAL', 'Structural'),
    ('00000000-0000-0000-0000-000000000001', 'CLAMP', 'Clamp'),
    ('00000000-0000-0000-0000-000000000001', 'STAY_SET', 'Stay Set'),
    ('00000000-0000-0000-0000-000000000001', 'TF_BELT', 'TF Belt'),
    ('00000000-0000-0000-0000-000000000001', 'HARDWARE', 'Hardware'),
    ('00000000-0000-0000-0000-000000000001', 'GOD', 'GOD'),
    ('00000000-0000-0000-0000-000000000001', 'LA', 'LA'),
    ('00000000-0000-0000-0000-000000000001', 'FASTENER', 'Fastener'),
    ('00000000-0000-0000-0000-000000000001', 'EARTHING', 'Earthing'),
    ('00000000-0000-0000-0000-000000000001', 'DB', 'DB'),
    ('00000000-0000-0000-0000-000000000001', 'LUG', 'Lug'),
    ('00000000-0000-0000-0000-000000000001', 'ACCESSORIES', 'Accessories')
ON CONFLICT ("org_id", "code") DO NOTHING;



--
-- Data for Name: items; Type: TABLE DATA; Schema: public; Owner: postgres
--


INSERT INTO "public"."items" (
    "id", "item_code", "name", "category_id", "sub_category",
    "material_type", "size_spec", "unit", "hsn_code",
    "is_traded", "is_manufactured", "is_raw_material",
    "reorder_level", "reorder_qty", "notes", "is_active",
    "created_by", "created_at", "updated_at"
)
SELECT
     v."id"::uuid,
    v."item_code",
    v."name",
    c."id",
    v."sub_category",
    v."material_type"::public.material_type,
    v."size_spec",
    v."unit"::public.unit_of_measure,
    v."hsn_code",
    v."is_traded",
    v."is_manufactured",
    v."is_raw_material",
    v."reorder_level",
    v."reorder_qty",
    v."notes",
	v."is_active",
	v."created_by"::uuid,
	v."created_at"::timestamptz,
	v."updated_at"::timestamptz
FROM (
    VALUES
	('4d7648eb-ce9e-4a58-8012-9c482369f919', 'CON-001', 'ACSR Dog Conductor', 'Conductor', 'ACSR', 'Aluminium', '0.1 sqmm | 2.5mtr/kg | 394kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fb20b785-e3fe-488c-971c-f633f89bbcee', 'CON-002', 'ACSR Raccoon Conductor', 'Conductor', 'ACSR', 'Aluminium', '80 sqmm | 3.2mtr/kg | 310kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1e42e2e3-2763-485c-afa4-122a9aab01ab', 'CON-003', 'ACSR Rabbit Conductor', 'Conductor', 'ACSR', 'Aluminium', '50 sqmm | 4.7mtr/kg | 214kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ac3491c9-3d5c-4c7f-b31a-7183b7d2f595', 'CON-004', 'ACSR Weasel Conductor', 'Conductor', 'ACSR', 'Aluminium', 'O3 | 7.8mtr/kg | 128kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4a6c2381-49be-45b2-bf75-01dcad6a31f0', 'CON-005', 'ACSR Panther Conductor', 'Conductor', 'ACSR', 'Aluminium', '0.25sqmm | 1km/kg | 974kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fcd5573a-b248-4f98-ace2-c27b487fa4e3', 'CON-006', 'AAC Gnat Conductor', 'Conductor', 'AAC', 'Aluminium', '25sqmm | 13.5mtr/kg | 74kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('dcb40665-6af5-4ce4-803b-eb306cf0e108', 'CON-007', 'AAC Ladybird Conductor', 'Conductor', 'AAC', 'Aluminium', '45sqmm | 8.5mtr/kg | 117kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('cca51cfe-1cf3-4762-9614-af2ef6bd858e', 'CON-008', 'AAAC Weasel Conductor', 'Conductor', 'AAAC', 'Aluminium', '34sqmm | 10mtr/kg | 94kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9a73997d-ab62-459a-bc6d-5b27dc23155c', 'CON-009', 'AAAC Ant Conductor', 'Conductor', 'AAAC', 'Aluminium', '55sqmm | 7mtr/kg | 145kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('2cee4916-d0f5-44b9-9ba9-4c50f6ab8154', 'CON-010', 'AAAC Raccoon Conductor', 'Conductor', 'AAAC', 'Aluminium', '80sqmm | 4.6mtr/kg | 218kg/km', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('31a961ff-09a4-49d7-9678-0ad2b8f090dd', 'CON-011', 'LT AAC Conductor 55sqmm', 'Conductor', 'LT', 'Aluminium', '55sqmm | 7mtr/kg', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('497636a5-a0aa-4858-b22c-1a364c56adb9', 'CON-012', 'LT AA Conductor 34sqmm', 'Conductor', 'LT', 'Aluminium', '34sqmm | 13mtr/kg', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1eb48110-e7e1-4984-a4f9-4eda2498c920', 'CON-013', 'HT Conductor 50sqmm', 'Conductor', 'HT', 'Aluminium', '50sqmm | 4.7mtr/kg', 'Mtr', '7604', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('e6800f87-d71a-4593-aaab-76f12aaddd98', 'CAB-001', 'LT Cable 300sqmm 4 Core Armoured XLPE', 'Cable', 'LT Armoured', 'Aluminium', '300sqmm 4C XLPE', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1fa48fb8-f7eb-4b8a-b338-95f6e58e5f3f', 'CAB-002', 'LT Cable 300sqmm 3.5 Core Armoured XLPE', 'Cable', 'LT Armoured', 'Aluminium', '300sqmm 3.5C XLPE', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('20bc41ea-57fa-46a1-ab41-30a5a2b33465', 'CAB-003', 'HT Cable 95sqmm 3 Core Armoured XLPE', 'Cable', 'HT Armoured', 'Aluminium', '95sqmm 3C XLPE', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('57e3d734-5e39-4a9b-bfaa-6a099ef132dd', 'CAB-004', 'LT Cable 50sqmm', 'Cable', 'LT', 'Aluminium', '50sqmm', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('25b9dde2-39db-4278-95b7-4885486da10a', 'CAB-005', 'LT Cable 70sqmm', 'Cable', 'LT', 'Aluminium', '70sqmm', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('da76d712-55fc-45f9-8658-529d80e1eb9d', 'CAB-006', 'LT Cable 95sqmm', 'Cable', 'LT', 'Aluminium', '95sqmm', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('e886e1bf-c809-46e2-b809-6c1186e54efa', 'CAB-007', 'LT Cable 120sqmm', 'Cable', 'LT', 'Aluminium', '120sqmm', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('77d0060d-b86d-48f0-b919-6f2fd5001074', 'CAB-008', 'LT Cable 185sqmm', 'Cable', 'LT', 'Aluminium', '185sqmm', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0c518c21-bf8a-485b-b16f-fb83214963fa', 'CAB-009', 'LT Cable 240sqmm', 'Cable', 'LT', 'Aluminium', '240sqmm', 'Mtr', '8544', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d0bc9683-34ae-40b5-b789-b445fe2969ed', 'INS-001', 'Pin Insulator Polymer 11KV 24mm', 'Insulator', 'Pin Polymer', 'Polymer', '11KV FRP 24MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7cea46cb-5d5d-46ab-b88b-299173478b36', 'INS-002', 'Pin Insulator Polymer 11KV 16mm', 'Insulator', 'Pin Polymer', 'Polymer', '11KV FRP 16MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7a1ad911-f478-4156-b25f-06f6fae089d1', 'INS-003', 'Post Insulator Polymer 11KV 24mm', 'Insulator', 'Post Polymer', 'Polymer', '11KV 57PCD 24MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4a329c4b-9321-482a-9fd4-47277d474733', 'INS-004', 'Post Insulator Polymer 11KV 16mm', 'Insulator', 'Post Polymer', 'Polymer', '11KV 57PCD 16MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('29ba375d-f89b-4d9f-b3e6-ccc5a5e657e1', 'INS-005', 'Pin Insulator Polymer 22KV 24mm', 'Insulator', 'Pin Polymer', 'Polymer', '22KV FRP 24MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('76d475ff-7be0-4141-892a-75768785ff06', 'INS-006', 'Post Insulator Polymer 22KV 24mm', 'Insulator', 'Post Polymer', 'Polymer', '22KV 57PCD 24MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('cd1639f8-2113-4eb7-805a-527145d51975', 'INS-007', 'Post Insulator Polymer 33KV 24mm', 'Insulator', 'Post Polymer', 'Polymer', '33KV 76PCD 24MM', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3c243971-f0c8-478f-8c2a-7ca192cda69b', 'INS-008', 'Disc Insulator 11KV 45KN', 'Insulator', 'Disc', 'Mixed', '11KV 45KN', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('e1717152-ade4-46db-9983-fe9ae8038bf7', 'INS-009', 'Disc Insulator 11KV 70KN', 'Insulator', 'Disc', 'Mixed', '11KV 70KN', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9a70a3cf-63ae-41b4-9b81-14f3143e447d', 'INS-010', 'Disc Insulator 22KV 70KN', 'Insulator', 'Disc', 'Polymer', '22KV 70KN', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('41555e43-f5aa-4ff8-8777-dcf46cb106b0', 'INS-011', 'Disc Insulator 33KV 70KN', 'Insulator', 'Disc', 'Polymer', '33KV 70KN', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('11ac6621-b11a-4ed9-8610-77ecdc764bce', 'INS-012', 'Pin Insulator 11KV Stud 16mm', 'Insulator', 'Pin Polymer', 'Polymer', '11KV Stud 16mm', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('6e695d1d-f348-4ee9-88b1-f89e921fc40e', 'INS-013', 'Pin Insulator 11KV Stud 20mm', 'Insulator', 'Pin Polymer', 'Polymer', '11KV Stud 20mm', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('adaf15ef-c5e9-4966-9643-7b13d8abf2f8', 'INS-014', 'Stay Insulator LT 90x65mm', 'Insulator', 'Stay', 'Porcelain', '90x65mm', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0839f432-be5a-4443-be47-1828988ad619', 'INS-015', 'Shackle Insulator LT 90x75mm', 'Insulator', 'Shackle', 'Porcelain', '90x75mm', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('bd21bc5f-3bb9-4d12-9b40-856f782a8d1d', 'INS-016', 'Post Insulator 11KV', 'Insulator', 'Post', 'Mixed', '11KV', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7eb8ea32-0aaa-44b4-862b-8ba38926d8c7', 'STR-001', 'Channel 100x50 11ft GI', 'Structural', 'Channel', 'GI', '100x50x11ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0dbd4a96-d1cc-4c41-8e27-97675d449ae2', 'STR-002', 'Channel 100x50 11ft MS', 'Structural', 'Channel', 'MS', '100x50x11ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('cbe0dcce-765e-49ce-81c5-fb93162230ed', 'STR-003', 'Channel 75x40 11ft GI', 'Structural', 'Channel', 'GI', '75x40x11ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f22643d6-3337-4f29-8c49-7387a628a948', 'STR-004', 'Channel 75x40 11ft MS', 'Structural', 'Channel', 'MS', '75x40x11ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9e67f896-84fb-45d3-b263-0dd2340d0b3c', 'STR-005', 'Guarding Channel 75x40 7ft GI', 'Structural', 'Guarding Channel', 'GI', '75x40x7ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('eb877e5c-d92b-4ff4-b553-faed8ebcce0b', 'STR-006', 'Guarding Channel 75x40 7ft MS', 'Structural', 'Guarding Channel', 'MS', '75x40x7ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f672af6d-1212-4931-96d0-14a60eda3298', 'STR-007', 'Suspension Channel 100x50 8ft GI', 'Structural', 'Suspension Channel', 'GI', '100x50x8ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('6876df5c-56fc-493e-be32-6065511c9451', 'STR-008', 'Suspension Channel 100x50 8ft MS', 'Structural', 'Suspension Channel', 'MS', '100x50x8ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('45ff3595-3dac-4e0f-baba-4e91e91926df', 'STR-009', 'Angle 2 Pin 3.9Kg GI', 'Structural', 'Angle', 'GI', '2 Pin 3.9kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('2001b93d-67bd-4a50-96b0-c430e1fee7ba', 'STR-010', 'Angle 2 Pin 3.9Kg MS', 'Structural', 'Angle', 'MS', '2 Pin 3.9kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c64affe5-cb15-4afe-8072-f6226243b388', 'STR-011', 'Angle 4 Pin 7Kg GI', 'Structural', 'Angle', 'GI', '4 Pin 7kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0fe74bd6-ab53-4256-9f03-97b0f8b21979', 'STR-012', 'Angle 4 Pin 7Kg MS', 'Structural', 'Angle', 'MS', '4 Pin 7kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7aa4312b-f0f8-4370-b3d5-10c5d56032a0', 'STR-013', 'Patti 5 Hole GI', 'Structural', 'Patti', 'GI', '5 hole', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fa468152-f3ed-4d3e-879e-a4416afe88de', 'STR-014', 'Patti 5 Hole MS', 'Structural', 'Patti', 'MS', '5 hole', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f720eed6-cb7c-45f9-9838-d3c0d8fb9397', 'STR-015', 'Patti 3 Hole 270mm GI', 'Structural', 'Patti', 'GI', '3 hole 270mm', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4e48bdaf-6506-41f6-bbc9-ee492a0d55b4', 'STR-016', 'Patti 3 Hole 270mm MS', 'Structural', 'Patti', 'MS', '3 hole 270mm', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3f8fe030-2183-4cea-9490-f14370ccd8a2', 'STR-017', 'Patti 3 Hole 220mm GI', 'Structural', 'Patti', 'GI', '3 hole 220mm', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fb5f264b-1198-41e8-b2e1-7fb9e31d1b77', 'STR-018', 'Patti 3 Hole 220mm MS', 'Structural', 'Patti', 'MS', '3 hole 220mm', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ec730727-3f18-476e-9bfe-1dcb77429b4b', 'STR-019', 'Patti 3 Hole Thin GI', 'Structural', 'Patti', 'GI', 'thin', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('a8b53478-31d4-4cc3-8fc1-f0aa4faaf9db', 'STR-020', 'Patti 3 Hole Thin MS', 'Structural', 'Patti', 'MS', 'thin', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('a0f2dc44-f8dc-486b-b5fd-e93c2abe96c2', 'STR-021', 'GOD Handle Support Channel 100x50 5.5ft', 'Structural', 'GOD Channel', 'GI', '100x50x5.5ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7f5475ff-041d-47ca-94f3-2d532cb79698', 'STR-022', 'GOD Handle Support Channel 75x40 3ft', 'Structural', 'GOD Channel', 'GI', '75x40x3ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('5e156514-71e3-4d99-91c5-58972d0cbe9c', 'STR-023', 'Guarding Angle 7ft GI', 'Structural', 'Guarding Angle', 'GI', '7ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('e7d4bb0f-f04c-4c35-8e7d-c636b7f622b5', 'STR-024', 'Guarding Angle 7ft MS', 'Structural', 'Guarding Angle', 'MS', '7ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('aaa0b2f4-7a8b-41f9-a154-3c82c0885c66', 'STR-025', 'Guarding Angle 5ft GI', 'Structural', 'Guarding Angle', 'GI', '5ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fd4c0ef3-cc33-4b7c-b25a-5e9af3128697', 'STR-026', 'Guarding Angle 5ft MS', 'Structural', 'Guarding Angle', 'MS', '5ft', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('eb65f87c-ee23-4e42-b049-ff03981fe327', 'CLM-001', 'Cross Arm Clamp 6x6 GI', 'Clamp', 'Cross Arm', 'GI', '6x6', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('45276e01-4f64-4e6c-8a4d-f5db3e685ad0', 'CLM-002', 'Cross Arm Clamp 6x6 MS', 'Clamp', 'Cross Arm', 'MS', '6x6', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d374feb8-7efc-4c30-bb81-eaacab52c9e2', 'CLM-003', 'Stay Clamp 6x6 GI', 'Clamp', 'Stay', 'GI', '6x6', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('90084680-a7d9-455b-ae9b-75bf62ba77e7', 'CLM-004', 'Stay Clamp 6x6 MS', 'Clamp', 'Stay', 'MS', '6x6', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('797d7ff5-2ab0-4eb2-af1b-88ded9bd7040', 'CLM-005', 'Cross Arm Clamp C&D 4x4.5 GI', 'Clamp', 'Cross Arm', 'GI', '4x4.5 C&D', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('efe05e9d-9117-49ed-8d17-37a9fee2e5d5', 'CLM-006', 'Cross Arm Clamp C&D 4x4.5 MS', 'Clamp', 'Cross Arm', 'MS', '4x4.5 C&D', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('03efb5f8-d5ff-4dc0-816e-7f6336641a0f', 'CLM-007', 'Stay Clamp C&D 4x4.5 GI', 'Clamp', 'Stay', 'GI', '4x4.5 C&D', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d2953161-33a3-43a1-ba2f-ffa462e01594', 'CLM-008', 'Stay Clamp C&D 4x4.5 MS', 'Clamp', 'Stay', 'MS', '4x4.5 C&D', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9c21998f-d0ce-42b8-a110-c9350cc22eaa', 'CLM-009', 'Cross Arm Clamp Long Axis C 5x3 GI', 'Clamp', 'Cross Arm', 'GI', '5x3 long axis C', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fc06a044-78a8-40c3-96d2-75a0f6ab88f4', 'CLM-010', 'Cross Arm Clamp Long Axis D 5x3 GI', 'Clamp', 'Cross Arm', 'GI', '5x3 long axis D', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0e669017-d1cf-4374-a9d9-494ad394c44f', 'CLM-011', 'Stay Clamp C&D 5x3 GI', 'Clamp', 'Stay', 'GI', '5x3', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('eb95d0e8-7d12-4570-9af4-98212a15e013', 'CLM-012', 'Stay Clamp C&D 5x3 MS', 'Clamp', 'Stay', 'MS', '5x3', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('15eb92bd-581a-4a29-8909-a3d084eefec7', 'CLM-013', 'PSC Pole Clamp C Long Axis GI', 'Clamp', 'PSC Pole', 'GI', 'long axis C', 'Pair', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4a07bf6a-b331-443b-b64e-c9920eee413d', 'CLM-014', 'PSC Pole Clamp D Short Axis GI', 'Clamp', 'PSC Pole', 'GI', 'short axis D', 'Pair', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4fad28e5-17b9-4fe9-86a0-498e0be7b764', 'CLM-015', 'Rail Pole Clamp GI', 'Clamp', 'Rail', 'GI', '', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('061ab53c-267a-4cf6-8a37-4ae97aafec60', 'CLM-016', 'Fiber Clamp 95sqmm', 'Clamp', 'Fiber', 'Polymer', '95sqmm', 'No.', '8515', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f10ffb12-ed61-4596-8ac5-3c7e4b90ee31', 'CLM-017', 'Fiber Clamp 300sqmm', 'Clamp', 'Fiber', 'Polymer', '300sqmm', 'No.', '8515', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('5aa2d589-4488-4020-afb5-820465cf42c9', 'CLM-018', 'D Clamp LT GI', 'Clamp', 'D Clamp', 'GI', 'LT', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ab7cf539-db3a-4c67-a897-fde379077152', 'CLM-019', 'PG Clamp', 'Clamp', 'PG', 'Other', '', 'No.', '8538', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ed52ce58-112b-4300-8de5-222bdd2192d8', 'CLM-020', 'V Cross Arm 22KV GI', 'Clamp', 'V Cross Arm', 'GI', '22KV 100x50', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7379f855-6163-4d27-8d1d-17348371ec2d', 'CLM-021', 'V Cross Arm 22KV MS', 'Clamp', 'V Cross Arm', 'MS', '22KV 100x50', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7149c2bc-b1ee-48a7-a67c-3d686f8e896f', 'CLM-022', 'V Cross Arm 11KV', 'Clamp', 'V Cross Arm', 'Other', '11KV', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('413303c0-7bca-4d8f-b5c1-fecadb635b9f', 'STS-001', 'HT Stay Set Complete', 'Stay Set', 'HT', 'GI', '20mm rod set', 'Set', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c6bd2016-af8c-4950-b1e8-b5cb1c245839', 'STS-002', 'HT Stay Set Rod', 'Stay Set', 'HT Component', 'GI', 'rod', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('23888b4b-cad7-4b63-9deb-ead9aaf702fa', 'STS-003', 'HT Stay Set I-bolt', 'Stay Set', 'HT Component', 'GI', 'i-bolt', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ad7fefdb-7a08-4f04-bdbd-38bfd72ec3de', 'STS-004', 'HT Stay Set Turnbuckle', 'Stay Set', 'HT Component', 'GI', 'turnbuckle', 'No.', '7208', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d5a3e7e1-f04f-4070-a4a0-284be2358351', 'STS-005', 'HT Stay Set Plate', 'Stay Set', 'HT Component', 'GI', 'plate', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('253e1571-7b3d-4155-aad5-6b869268d458', 'STS-006', 'LT Stay Set Complete', 'Stay Set', 'LT', 'GI', '16mm rod set', 'Set', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9938034f-097d-4cab-b87c-d3f3759ef900', 'STS-007', 'LT Stay Set Rod', 'Stay Set', 'LT Component', 'GI', 'rod', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('2bba6a7d-caa7-4c9b-9159-21744354f0a7', 'STS-008', 'LT Stay Set I-bolt', 'Stay Set', 'LT Component', 'GI', 'i-bolt', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0f2ca16e-3b23-4167-b7e7-83a152e59cbf', 'STS-009', 'LT Stay Set Turnbuckle', 'Stay Set', 'LT Component', 'GI', 'turnbuckle', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('aa800ead-eae6-4472-8ab0-6d108750eb96', 'STS-010', 'LT Stay Set Plate', 'Stay Set', 'LT Component', 'GI', 'plate', 'No.', '7208', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b12152e1-bd59-40ba-a386-3b18d27e726b', 'STS-011', 'U Bolt 16mm', 'Stay Set', 'U Bolt', 'GI', '16mm', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('6aae197f-6557-4d82-b913-4f5c9a34edbd', 'STS-012', 'Plate Frame 1x1ft', 'Stay Set', 'Plate Frame', 'GI', '1x1 ft', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('09009ce1-e9dc-4932-ae7c-e762de947e4e', 'STS-013', 'Plate Frame 17x17in', 'Stay Set', 'Plate Frame', 'GI', '17x17 in', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('57730208-1dbe-4cd6-9c9e-3aeaef42611b', 'STS-014', 'Plate Frame 22x22in', 'Stay Set', 'Plate Frame', 'GI', '22x22 in', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('806beb57-119f-4438-a74c-3ed488da1d87', 'STS-015', 'Bracket LT 6mm Angle', 'Stay Set', 'Bracket', 'GI', '2+4+2ft', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ac25fc96-103d-4507-a452-6b234317b9af', 'STS-016', 'Bracket LT 5mm Angle', 'Stay Set', 'Bracket', 'GI', '2+4+2ft', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7a15d802-70bb-4f1b-b927-6a2d5257b3f8', 'TFB-001', 'T/F Belt Set Short GI', 'TF Belt', 'Short', 'GI', 'short', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('53558512-e7bd-4b74-b667-8b4a4fe03cb9', 'TFB-002', 'T/F Belt Set Short MS', 'TF Belt', 'Short', 'MS', 'short', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7d22f5b6-6bc8-453e-8b33-a62cdfbfe5d2', 'TFB-003', 'T/F Belt Long GI', 'TF Belt', 'Long', 'GI', 'long', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7c239709-4bbc-4979-a9eb-9e730d4652b9', 'TFB-004', 'Transformer Belt 2+2 GI', 'TF Belt', 'Full Set', 'GI', '11+11+2+2ft', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4eddfcf9-2e13-48e6-ac03-0a0c4848b206', 'TFB-005', 'Transformer Belt 2+2 MS', 'TF Belt', 'Full Set', 'MS', '11+11+2+2ft', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0a6fe9e1-5c19-4110-90ac-7f8f251d2498', 'HW-001', 'Tension Hardware Fitting 3 Bolt', 'Hardware', 'Tension', 'GI', '3 bolt 340wt', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0e505bc4-e312-4ece-b310-1f7779699961', 'HW-002', 'Tension Hardware Fitting 2 Bolt', 'Hardware', 'Tension', 'GI', '2 bolt 275wt', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b2ca9186-2f22-40f4-95ce-47cc96167c53', 'HW-003', 'Suspension Hardware Set', 'Hardware', 'Suspension', 'Other', '', 'No.', '7409', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('baf67f4d-3aa3-4b35-81ec-cedc7cdf327b', 'HW-004', 'CutPoint Set Porcelain', 'Hardware', 'CutPoint', 'Porcelain', '', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('cdf012c9-ebb2-4942-91f5-4e6a5272bb97', 'HW-005', 'CutPoint Set Polymer 22KV', 'Hardware', 'CutPoint', 'Polymer', '22KV', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('fe76c197-de50-47b0-bada-f4dfc8ab72ef', 'HW-006', 'CutPoint Set 11KV', 'Hardware', 'CutPoint', 'Polymer', '11KV', 'Set', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('29654471-bdf0-4a21-98b3-e139f8d1eb3c', 'HW-007', 'Horn Gap Set Porcelain', 'Hardware', 'Horn Gap', 'Porcelain', '', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b449e4f7-98b6-4dfe-a24f-d940c287b364', 'HW-008', 'Horn Gap Set Polymer 22KV', 'Hardware', 'Horn Gap', 'Polymer', '22KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('2169cdf2-b031-4aa1-99de-63fd00dfd0b6', 'HW-009', 'Top Fitting Vertical', 'Hardware', 'Top Fitting', 'Other', '', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c7a2cedc-3a1a-4e5d-a3b3-61a91c771111', 'HW-010', 'Top Fitting 11KV', 'Hardware', 'Top Fitting', 'Other', '11KV', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('842d081a-5a61-47a6-a12d-4a6d67af4813', 'GOD-001', 'G.O.D. Set 22KV 200A/400A', 'GOD', 'Complete Set', 'Other', '22KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('eb647540-904f-4353-9255-ed76961d0878', 'GOD-002', 'G.O.D. Set 11KV', 'GOD', 'Complete Set', 'Other', '11KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('2600b043-d81b-4680-9da4-ba2381be310d', 'GOD-003', 'D.O. Set 22KV', 'GOD', 'DO Set', 'Other', '22KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1a36fa6f-b898-4fae-9ad5-2b6b7f87418a', 'GOD-004', 'D.O. Set 11KV', 'GOD', 'DO Set', 'Other', '11KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('67d7d4e1-9ecd-457a-8d31-59ea54ca0c28', 'GOD-005', 'Single Piece GOD', 'GOD', 'Single', 'Other', '', 'No.', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('cb1a6374-f2e2-47e3-abc6-7dd8a65d42f2', 'GOD-006', 'GOD Pipe', 'GOD', 'Part', 'GI', '', 'Set', '8307', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3d1d4df1-e762-4aaa-bd1d-f4d9dfd3d328', 'GOD-007', 'GOD Rod Light wt 1.75kg', 'GOD', 'Part', 'GI', 'light wt 1.75kg', 'No.', '8307', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('dacb6d04-5686-4949-9837-82d718a76f4c', 'GOD-008', 'GOD Rod Heavy wt 11.35kg', 'GOD', 'Part', 'GI', 'heavy wt 11.35kg', 'No.', '8307', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c5a6d1ae-5bde-4c4b-b5b3-85fe5248d999', 'GOD-009', 'GOD Lever', 'GOD', 'Part', 'Other', '', 'No.', '8307', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f84ae56f-7d1e-42b0-9a8c-856ae3014924', 'GOD-010', 'GOD Handle', 'GOD', 'Part', 'Other', '', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('80dd318f-6868-435b-a651-c64d479a7847', 'GOD-011', 'GOD Contact Set', 'GOD', 'Part', 'Other', '', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('982767f3-5937-4063-bc31-e9e934fc91df', 'GOD-012', 'GOD Copper Belt Braided 25x2mm', 'GOD', 'Part', 'Copper', '25x2mm braided', 'No.', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('00014870-0a07-42b8-a4a1-ca570652114e', 'GOD-013', 'GOD Copper Patti 40x5mm', 'GOD', 'Part', 'Copper', '40x5mm', 'Kg', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('846d47d1-6e67-40bc-b36b-ad231c5849ba', 'GOD-014', 'GOD Copper Contact', 'GOD', 'Part', 'Copper', '', 'No.', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('a39deff0-ee90-4162-a035-ee223fe676cf', 'GOD-015', 'GOD Padistor', 'GOD', 'Part', 'Other', '', 'No.', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f302b498-88f2-46d4-b1e9-69483fd16ae1', 'GOD-016', 'GOD Spring', 'GOD', 'Part', 'Other', '', 'No.', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7c62554d-9e7f-480c-b8ab-a0cbf867bcae', 'GOD-017', 'GOD Rivet', 'GOD', 'Part', 'Other', '', 'No.', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c2e148ec-6517-44e2-9116-f5d31a3e4a8b', 'GOD-018', 'Horn Gap Contact Ring Set', 'GOD', 'Part', 'Other', '', 'Set', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('a6816dbe-c071-4abc-b371-5dd304635859', 'GOD-019', 'D.O. Horn Gap Polymer', 'GOD', 'DO Part', 'Polymer', '', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c31b634a-3d4b-4aec-b59d-1bda08074f68', 'GOD-020', 'D.O. Horn Gap Porcelain', 'GOD', 'DO Part', 'Porcelain', '', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9c8d9341-4b82-4792-8fe7-12c76a96246c', 'LA-001', 'L.A. Set 22KV', 'LA', 'Complete', 'Other', '22KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f83f78a8-3d80-4be6-8775-fd883ad269a7', 'LA-002', 'L.A. Set 11KV', 'LA', 'Complete', 'Other', '11KV', 'Set', '8535', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d1835b2b-3e70-4219-959e-226102e113fb', 'NB-001', 'Nut Bolt M16x75 5/8x3in', 'Fastener', 'Nut Bolt', 'GI', 'M16x75 0.2kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('85099472-7110-477c-86ac-c74d527f005f', 'NB-002', 'Nut Bolt M16x100 5/8x4in', 'Fastener', 'Nut Bolt', 'GI', 'M16x100 0.25kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7aba8d4c-3f1d-4405-9666-22b7a40c59ee', 'NB-003', 'Nut Bolt M16x150 5/8x6in', 'Fastener', 'Nut Bolt', 'GI', 'M16x150 0.3kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c5dc55b5-28ad-46e4-9e94-9c1073429f64', 'NB-004', 'Nut Bolt M16x200 5/8x8in', 'Fastener', 'Nut Bolt', 'GI', 'M16x200 0.4kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4fe12233-95aa-422c-a436-7c6d1ee6910e', 'NB-005', 'Nut Bolt M12x75 1/2x3in', 'Fastener', 'Nut Bolt', 'GI', 'M12x75 0.125kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d3b07e90-58ef-46a5-8633-c65dd10c8d7a', 'NB-006', 'Nut Bolt M12x125 1/2x6in', 'Fastener', 'Nut Bolt', 'GI', 'M12x125 0.175kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('303e10ab-000e-47d3-9bd0-d99af52557bf', 'NB-007', 'Nut Bolt M12x40 1/2x1.5in', 'Fastener', 'Nut Bolt', 'GI', 'M12x40 0.1kg', 'No.', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9976fbe8-88ff-4262-afae-16b8fb41c42e', 'NB-008', 'Shackle Nut Bolt GI', 'Fastener', 'Shackle NB', 'GI', '1kg=12no', 'Kg', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ffc5dbf7-0e53-4fb8-99fb-666a123b7fa5', 'NB-009', 'Shackle Patti GI', 'Fastener', 'Shackle Patti', 'GI', '1kg=16no', 'Kg', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9eaddd9a-602d-40a4-971e-4a5f437738eb', 'NB-010', 'Earthing Nut Bolt GI', 'Fastener', 'Earthing NB', 'GI', '', 'Kg', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('dea8d062-96b9-4170-bf8d-f47a7d30eef0', 'NB-011', 'GI Wire', 'Fastener', 'GI Wire', 'GI', '', 'Kg', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('92be5a49-1b39-4ee2-800b-9cc59071901e', 'NB-012', 'D.O. Hook', 'Fastener', 'DO Hook', 'GI', '', 'No.', '7308', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4cbe38a9-0f52-400b-ae65-26a4802dca2e', 'ERT-001', 'Earthing Iron Plate 12x12in', 'Earthing', 'Plate', 'GI', '300x300mm | 1.9kg (4mm)', 'No.', '8438', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('a01b0bbf-fafc-46f9-92aa-71ad400e6c62', 'ERT-002', 'Earthing Iron Plate 17x17in', 'Earthing', 'Plate', 'GI', '450x450mm', 'No.', '8438', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('65fb6759-fb8b-41a3-9374-6c6ece732f0d', 'ERT-003', 'Earthing Iron Plate 22x22in', 'Earthing', 'Plate', 'GI', '600x600mm', 'No.', '8438', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1d9508cc-28ff-486b-ae89-76283ae0902c', 'ERT-004', 'GI Pipe Earthing Without Funnel', 'Earthing', 'Pipe', 'GI', 'wt 1.1kg', 'No.', '8307', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('da6e0324-96ac-4530-b67f-a1306d344b0c', 'ERT-005', 'GI Pipe Earthing With Funnel', 'Earthing', 'Pipe', 'GI', 'with funnel', 'No.', '8307', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('4eb02a69-28af-4ae3-b4d9-36574e24ad94', 'ERT-006', 'Earthing Patti 25x3mm', 'Earthing', 'Patti', 'GI', '25x3mm', 'Kg', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3d3ede72-4937-43a4-b712-b47551d55725', 'ERT-007', 'Earthing Patti 50x6mm', 'Earthing', 'Patti', 'GI', '50x6mm', 'Kg', '7308', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('10943968-c540-44a8-9709-64a075af70c4', 'ERT-008', 'Earthing Betnater Powder', 'Earthing', 'Powder', 'Chemical', '', 'Kg', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('d76cc405-4426-4506-a7e9-6c330ba93337', 'ERT-009', 'Earthing Chamber Cover 1x1ft', 'Earthing', 'Chamber', 'Concrete', '1x1ft', 'No.', '7326', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('5ed01e77-987f-4a4d-b7b9-6d982b6936b3', 'ERT-010', 'Earthing Copper Patti 25x3mm', 'Earthing', 'Patti', 'Copper', '25x3mm', 'Kg', '', false, true, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('708fa213-046c-4c07-8262-e4c35885f4f2', 'DB-001', 'Distribution Box 100KV Single CKT', 'DB', 'Single', 'Other', '100KV Single', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('0e11e4fc-0009-4c92-b5e4-2995815fdafb', 'DB-002', 'Distribution Box 100KV Double CKT', 'DB', 'Double', 'Other', '100KV Double', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b67b1e82-7a64-493a-bfe1-76a0200f2555', 'DB-003', 'Distribution Box 150KV Single CKT', 'DB', 'Single', 'Other', '150KV Single', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7beff6ab-94f1-4c1b-92de-e7037ffea447', 'DB-004', 'Distribution Box 150KV Double CKT', 'DB', 'Double', 'Other', '150KV Double', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c63b30c8-7184-440f-ac86-64a3ab385171', 'DB-005', 'Distribution Box 200KV Single CKT', 'DB', 'Single', 'Other', '200KV Single', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('54f02152-2a7b-4cdb-937d-3ee19416e942', 'DB-006', 'Distribution Box 200KV Double CKT', 'DB', 'Double', 'Other', '200KV Double', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('be4fcbdb-65d1-4f9d-8d81-45cd8ebab927', 'DB-007', 'Distribution Box 150A MCCB Single', 'DB', 'MCCB', 'Other', '150A MCCB', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b358759e-4035-4f1c-8827-01810dc25d13', 'DB-008', 'Distribution Box 250A Double', 'DB', 'Double', 'Other', '250A Double', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1512c2fa-1cf2-4dc3-8484-e2be69027cf2', 'DB-009', 'Distribution Box 400A MCCB Double', 'DB', 'MCCB Double', 'Other', '400A MCCB', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('344018ed-38b4-4c09-bca4-8b0e8b6a468c', 'DB-010', 'Mini Pillar Bus Bar', 'DB', 'Mini Pillar', 'Other', '', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('cd5cdba6-eb40-4237-8abe-93b2aa451477', 'DB-011', 'One Way Fuse', 'DB', 'One Way', 'Other', 'fuse', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9536c4ee-3ad8-4bc8-aeba-d546e46c9a96', 'DB-012', '4 Way Plain', 'DB', '4 Way', 'Other', '', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('00813bc9-ebdf-4123-abdd-13ddc863a07b', 'DB-013', '4 Way Feeder Pillar 250 MCCB', 'DB', 'Feeder Pillar', 'Other', '250 MCCB', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('8981c7ea-5387-4d8f-bbc7-b1e924c01789', 'DB-014', '4 Way Feeder Pillar 600A MCCB DTC Meter', 'DB', 'Feeder Pillar', 'Other', '600A MCCB+DTC', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('265a046f-0eee-4625-aa5c-a10af66e5b08', 'DB-015', '6 Way Feeder Pillar 800 MCCB', 'DB', 'Feeder Pillar', 'Other', '800 MCCB', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3889406f-286b-48ef-9ce3-b9ae76334b9d', 'DB-016', 'DTC Meter 100/5', 'DB', 'Meter', 'Other', '100/5', 'No.', '9028', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('16ab7c43-ac10-48b0-a6ae-913d274959b7', 'DB-017', '200/5 LT CT', 'DB', 'CT', 'Other', '200/5 LT', 'No.', '8504', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b82c621b-4f35-410c-9d21-95337db6fcae', 'DB-018', 'HRC Fuse Link', 'DB', 'Fuse', 'Other', '', 'No.', '8536', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('797a01ca-f5d9-49b6-84f0-df13d8371402', 'DB-019', 'GI Coupling', 'DB', 'Coupling', 'GI', '', 'No.', '7307', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ec9c1636-95f1-4931-bbfd-0812bfb39d1c', 'DB-020', 'Fiber Tube', 'DB', 'Tube', 'Other', '', 'No.', '8546', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9fe73e7a-39b9-4305-9fe5-2f8b2d6cab08', 'LUG-001', 'Aluminium Lug 25sqmm', 'Lug', 'AL Lug', 'Aluminium', '25sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('7482a567-38ca-4733-afdb-562306df5e6c', 'LUG-002', 'Aluminium Lug 35sqmm', 'Lug', 'AL Lug', 'Aluminium', '35sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('5e5b115a-edb2-478a-b4c6-65e79ad4b00e', 'LUG-003', 'Aluminium Lug 50sqmm', 'Lug', 'AL Lug', 'Aluminium', '50sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('f763a59d-348f-4256-ba80-ddb1c2e4d00b', 'LUG-004', 'Aluminium Lug 70sqmm', 'Lug', 'AL Lug', 'Aluminium', '70sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('25d4689d-6852-44a5-af63-a42839f69999', 'LUG-005', 'Aluminium Lug 95sqmm', 'Lug', 'AL Lug', 'Aluminium', '95sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('1f3a706c-40b5-4980-8538-80c6e191a9d0', 'LUG-006', 'Aluminium Lug 120sqmm', 'Lug', 'AL Lug', 'Aluminium', '120sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('efe23c5a-fa99-41e9-a7c9-cae6d8130188', 'LUG-007', 'Aluminium Lug 150sqmm', 'Lug', 'AL Lug', 'Aluminium', '150sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3268f6a9-d998-419a-8dfd-5787cb5b227f', 'LUG-008', 'Aluminium Lug 185sqmm', 'Lug', 'AL Lug', 'Aluminium', '185sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('c6b9c1a8-3847-4746-8a47-75b503309463', 'ACC-001', 'Wedge Connector Rabbit', 'Accessories', 'Wedge Connector', 'Aluminium', 'Rabbit', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('9f9eedfd-df9e-4f87-ba66-2d188b9265b8', 'ACC-002', 'Wedge Connector Dog', 'Accessories', 'Wedge Connector', 'Aluminium', 'Dog', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('ae2734ab-042e-485d-8a65-030876063d99', 'ACC-003', 'Line Spacer 1Ph 2Wire', 'Accessories', 'Spacer', 'Polymer', '1ph 2wire', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b6f8b21b-ec8a-4b28-a64c-8973e51cf87a', 'ACC-004', 'Line Spacer 1Ph 3Wire', 'Accessories', 'Spacer', 'Polymer', '1ph 3wire', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('8888b02b-76d8-4c7d-adee-a1d587365193', 'ACC-005', 'Line Spacer 3Ph 4Wire', 'Accessories', 'Spacer', 'Polymer', '3ph 4wire', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('00f544b4-f5b0-4592-be63-d35ee44633cd', 'ACC-006', 'HT Termination Kit 95sqmm 3C', 'Accessories', 'Term Kit', 'Other', '3Cx95sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('3adaa692-69fd-4ae8-9a52-2fbc85bfbe20', 'ACC-007', 'HT Termination Kit 185sqmm', 'Accessories', 'Term Kit', 'Other', '185sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('b7433b67-30a4-4418-9a6a-b29f6208beb8', 'ACC-008', 'HT Termination Kit 300sqmm', 'Accessories', 'Term Kit', 'Other', '300sqmm', 'No.', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('8643c6b8-801d-4d3b-a1ea-d04b08a9615b', 'ACC-009', 'Barbad Wire', 'Accessories', 'Wire', 'GI', '', 'Kg', '7313', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('36fc6f39-4b80-4b7f-89ef-97bb4c82a7db', 'ACC-010', 'Stay Wire GI', 'Accessories', 'Stay Wire', 'GI', '', 'Kg', '7217', true, false, true, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('a62300c6-1b07-4990-b74b-c65a4d1c769b', 'ACC-011', 'Fuse Wire', 'Accessories', 'Fuse Wire', 'Aluminium', '', 'Kg', '7408', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('28868702-13c7-4563-8c4a-760620a2e965', 'ACC-012', 'Alkathene Pipe', 'Accessories', 'Pipe', 'HDPE', '', 'Mtr', '', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('e4c094db-8734-404b-87e7-5814f6e45948', 'ACC-013', 'Danger Board 22KV 33KV', 'Accessories', 'Signage', 'Other', '22KV/33KV', 'No.', '7313', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('e51ccbf7-a575-4e51-b971-00517aaecec0', 'ACC-014', 'Danger Board 11KV', 'Accessories', 'Signage', 'Other', '11KV', 'No.', '7313', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00'),
	('42375aed-8d23-4020-b07c-b9de9681fb0a', 'ACC-015', 'Aluminium Bobin LT Line', 'Accessories', 'Bobin', 'Aluminium', 'LT', 'No.', '4822', true, false, false, 0.00, 0.00, NULL, true, NULL, '2026-05-16 01:03:33.351499+00', '2026-05-16 01:03:33.351499+00')) AS v(
    "id", "item_code", "name", "category_name", "sub_category",
    "material_type", "size_spec", "unit", "hsn_code",
    "is_traded", "is_manufactured", "is_raw_material",
    "reorder_level", "reorder_qty", "notes", "is_active",
    "created_by", "created_at", "updated_at"
)
JOIN "public"."item_categories" AS c
    ON c."org_id" = '00000000-0000-0000-0000-000000000001'
   AND c."name" = v."category_name";


--
-- Data for Name: bom; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sales_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: delivery_challans; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: sales_order_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: delivery_challan_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inbound_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inbound_receipt_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inventory_balance; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory_balance" ("item_id", "current_qty", "reserved_qty", "updated_at") VALUES
	('4d7648eb-ce9e-4a58-8012-9c482369f919', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fb20b785-e3fe-488c-971c-f633f89bbcee', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1e42e2e3-2763-485c-afa4-122a9aab01ab', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ac3491c9-3d5c-4c7f-b31a-7183b7d2f595', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4a6c2381-49be-45b2-bf75-01dcad6a31f0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fcd5573a-b248-4f98-ace2-c27b487fa4e3', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('dcb40665-6af5-4ce4-803b-eb306cf0e108', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('cca51cfe-1cf3-4762-9614-af2ef6bd858e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9a73997d-ab62-459a-bc6d-5b27dc23155c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('2cee4916-d0f5-44b9-9ba9-4c50f6ab8154', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('31a961ff-09a4-49d7-9678-0ad2b8f090dd', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('497636a5-a0aa-4858-b22c-1a364c56adb9', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1eb48110-e7e1-4984-a4f9-4eda2498c920', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('e6800f87-d71a-4593-aaab-76f12aaddd98', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1fa48fb8-f7eb-4b8a-b338-95f6e58e5f3f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('20bc41ea-57fa-46a1-ab41-30a5a2b33465', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('57e3d734-5e39-4a9b-bfaa-6a099ef132dd', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('25b9dde2-39db-4278-95b7-4885486da10a', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('da76d712-55fc-45f9-8658-529d80e1eb9d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('e886e1bf-c809-46e2-b809-6c1186e54efa', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('77d0060d-b86d-48f0-b919-6f2fd5001074', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0c518c21-bf8a-485b-b16f-fb83214963fa', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d0bc9683-34ae-40b5-b789-b445fe2969ed', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7cea46cb-5d5d-46ab-b88b-299173478b36', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7a1ad911-f478-4156-b25f-06f6fae089d1', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4a329c4b-9321-482a-9fd4-47277d474733', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('29ba375d-f89b-4d9f-b3e6-ccc5a5e657e1', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('76d475ff-7be0-4141-892a-75768785ff06', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('cd1639f8-2113-4eb7-805a-527145d51975', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3c243971-f0c8-478f-8c2a-7ca192cda69b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('e1717152-ade4-46db-9983-fe9ae8038bf7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9a70a3cf-63ae-41b4-9b81-14f3143e447d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('41555e43-f5aa-4ff8-8777-dcf46cb106b0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('11ac6621-b11a-4ed9-8610-77ecdc764bce', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('6e695d1d-f348-4ee9-88b1-f89e921fc40e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('adaf15ef-c5e9-4966-9643-7b13d8abf2f8', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0839f432-be5a-4443-be47-1828988ad619', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('bd21bc5f-3bb9-4d12-9b40-856f782a8d1d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7eb8ea32-0aaa-44b4-862b-8ba38926d8c7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0dbd4a96-d1cc-4c41-8e27-97675d449ae2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('cbe0dcce-765e-49ce-81c5-fb93162230ed', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f22643d6-3337-4f29-8c49-7387a628a948', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9e67f896-84fb-45d3-b263-0dd2340d0b3c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('eb877e5c-d92b-4ff4-b553-faed8ebcce0b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f672af6d-1212-4931-96d0-14a60eda3298', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('6876df5c-56fc-493e-be32-6065511c9451', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('45ff3595-3dac-4e0f-baba-4e91e91926df', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('2001b93d-67bd-4a50-96b0-c430e1fee7ba', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c64affe5-cb15-4afe-8072-f6226243b388', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0fe74bd6-ab53-4256-9f03-97b0f8b21979', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7aa4312b-f0f8-4370-b3d5-10c5d56032a0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fa468152-f3ed-4d3e-879e-a4416afe88de', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f720eed6-cb7c-45f9-9838-d3c0d8fb9397', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4e48bdaf-6506-41f6-bbc9-ee492a0d55b4', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3f8fe030-2183-4cea-9490-f14370ccd8a2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fb5f264b-1198-41e8-b2e1-7fb9e31d1b77', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ec730727-3f18-476e-9bfe-1dcb77429b4b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('a8b53478-31d4-4cc3-8fc1-f0aa4faaf9db', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('a0f2dc44-f8dc-486b-b5fd-e93c2abe96c2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7f5475ff-041d-47ca-94f3-2d532cb79698', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('5e156514-71e3-4d99-91c5-58972d0cbe9c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('e7d4bb0f-f04c-4c35-8e7d-c636b7f622b5', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('aaa0b2f4-7a8b-41f9-a154-3c82c0885c66', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fd4c0ef3-cc33-4b7c-b25a-5e9af3128697', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('eb65f87c-ee23-4e42-b049-ff03981fe327', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('45276e01-4f64-4e6c-8a4d-f5db3e685ad0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d374feb8-7efc-4c30-bb81-eaacab52c9e2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('90084680-a7d9-455b-ae9b-75bf62ba77e7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('797d7ff5-2ab0-4eb2-af1b-88ded9bd7040', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('efe05e9d-9117-49ed-8d17-37a9fee2e5d5', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('03efb5f8-d5ff-4dc0-816e-7f6336641a0f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d2953161-33a3-43a1-ba2f-ffa462e01594', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9c21998f-d0ce-42b8-a110-c9350cc22eaa', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fc06a044-78a8-40c3-96d2-75a0f6ab88f4', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0e669017-d1cf-4374-a9d9-494ad394c44f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('eb95d0e8-7d12-4570-9af4-98212a15e013', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('15eb92bd-581a-4a29-8909-a3d084eefec7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4a07bf6a-b331-443b-b64e-c9920eee413d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4fad28e5-17b9-4fe9-86a0-498e0be7b764', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('061ab53c-267a-4cf6-8a37-4ae97aafec60', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f10ffb12-ed61-4596-8ac5-3c7e4b90ee31', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('5aa2d589-4488-4020-afb5-820465cf42c9', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ab7cf539-db3a-4c67-a897-fde379077152', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ed52ce58-112b-4300-8de5-222bdd2192d8', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7379f855-6163-4d27-8d1d-17348371ec2d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7149c2bc-b1ee-48a7-a67c-3d686f8e896f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('413303c0-7bca-4d8f-b5c1-fecadb635b9f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c6bd2016-af8c-4950-b1e8-b5cb1c245839', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('23888b4b-cad7-4b63-9deb-ead9aaf702fa', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ad7fefdb-7a08-4f04-bdbd-38bfd72ec3de', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d5a3e7e1-f04f-4070-a4a0-284be2358351', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('253e1571-7b3d-4155-aad5-6b869268d458', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9938034f-097d-4cab-b87c-d3f3759ef900', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('2bba6a7d-caa7-4c9b-9159-21744354f0a7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0f2ca16e-3b23-4167-b7e7-83a152e59cbf', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('aa800ead-eae6-4472-8ab0-6d108750eb96', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b12152e1-bd59-40ba-a386-3b18d27e726b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('6aae197f-6557-4d82-b913-4f5c9a34edbd', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('09009ce1-e9dc-4932-ae7c-e762de947e4e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('57730208-1dbe-4cd6-9c9e-3aeaef42611b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('806beb57-119f-4438-a74c-3ed488da1d87', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ac25fc96-103d-4507-a452-6b234317b9af', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7a15d802-70bb-4f1b-b927-6a2d5257b3f8', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('53558512-e7bd-4b74-b667-8b4a4fe03cb9', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7d22f5b6-6bc8-453e-8b33-a62cdfbfe5d2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7c239709-4bbc-4979-a9eb-9e730d4652b9', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4eddfcf9-2e13-48e6-ac03-0a0c4848b206', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0a6fe9e1-5c19-4110-90ac-7f8f251d2498', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0e505bc4-e312-4ece-b310-1f7779699961', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b2ca9186-2f22-40f4-95ce-47cc96167c53', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('baf67f4d-3aa3-4b35-81ec-cedc7cdf327b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('cdf012c9-ebb2-4942-91f5-4e6a5272bb97', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('fe76c197-de50-47b0-bada-f4dfc8ab72ef', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('29654471-bdf0-4a21-98b3-e139f8d1eb3c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b449e4f7-98b6-4dfe-a24f-d940c287b364', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('2169cdf2-b031-4aa1-99de-63fd00dfd0b6', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c7a2cedc-3a1a-4e5d-a3b3-61a91c771111', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('842d081a-5a61-47a6-a12d-4a6d67af4813', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('eb647540-904f-4353-9255-ed76961d0878', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('2600b043-d81b-4680-9da4-ba2381be310d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1a36fa6f-b898-4fae-9ad5-2b6b7f87418a', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('67d7d4e1-9ecd-457a-8d31-59ea54ca0c28', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('cb1a6374-f2e2-47e3-abc6-7dd8a65d42f2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3d1d4df1-e762-4aaa-bd1d-f4d9dfd3d328', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('dacb6d04-5686-4949-9837-82d718a76f4c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c5a6d1ae-5bde-4c4b-b5b3-85fe5248d999', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f84ae56f-7d1e-42b0-9a8c-856ae3014924', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('80dd318f-6868-435b-a651-c64d479a7847', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('982767f3-5937-4063-bc31-e9e934fc91df', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('00014870-0a07-42b8-a4a1-ca570652114e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('846d47d1-6e67-40bc-b36b-ad231c5849ba', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('a39deff0-ee90-4162-a035-ee223fe676cf', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f302b498-88f2-46d4-b1e9-69483fd16ae1', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7c62554d-9e7f-480c-b8ab-a0cbf867bcae', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c2e148ec-6517-44e2-9116-f5d31a3e4a8b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('a6816dbe-c071-4abc-b371-5dd304635859', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c31b634a-3d4b-4aec-b59d-1bda08074f68', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9c8d9341-4b82-4792-8fe7-12c76a96246c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f83f78a8-3d80-4be6-8775-fd883ad269a7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d1835b2b-3e70-4219-959e-226102e113fb', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('85099472-7110-477c-86ac-c74d527f005f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7aba8d4c-3f1d-4405-9666-22b7a40c59ee', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c5dc55b5-28ad-46e4-9e94-9c1073429f64', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4fe12233-95aa-422c-a436-7c6d1ee6910e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d3b07e90-58ef-46a5-8633-c65dd10c8d7a', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('303e10ab-000e-47d3-9bd0-d99af52557bf', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9976fbe8-88ff-4262-afae-16b8fb41c42e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ffc5dbf7-0e53-4fb8-99fb-666a123b7fa5', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9eaddd9a-602d-40a4-971e-4a5f437738eb', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('dea8d062-96b9-4170-bf8d-f47a7d30eef0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('92be5a49-1b39-4ee2-800b-9cc59071901e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4cbe38a9-0f52-400b-ae65-26a4802dca2e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('a01b0bbf-fafc-46f9-92aa-71ad400e6c62', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('65fb6759-fb8b-41a3-9374-6c6ece732f0d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1d9508cc-28ff-486b-ae89-76283ae0902c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('da6e0324-96ac-4530-b67f-a1306d344b0c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('4eb02a69-28af-4ae3-b4d9-36574e24ad94', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3d3ede72-4937-43a4-b712-b47551d55725', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('10943968-c540-44a8-9709-64a075af70c4', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('d76cc405-4426-4506-a7e9-6c330ba93337', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('5ed01e77-987f-4a4d-b7b9-6d982b6936b3', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('708fa213-046c-4c07-8262-e4c35885f4f2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('0e11e4fc-0009-4c92-b5e4-2995815fdafb', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b67b1e82-7a64-493a-bfe1-76a0200f2555', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7beff6ab-94f1-4c1b-92de-e7037ffea447', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c63b30c8-7184-440f-ac86-64a3ab385171', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('54f02152-2a7b-4cdb-937d-3ee19416e942', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('be4fcbdb-65d1-4f9d-8d81-45cd8ebab927', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b358759e-4035-4f1c-8827-01810dc25d13', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1512c2fa-1cf2-4dc3-8484-e2be69027cf2', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('344018ed-38b4-4c09-bca4-8b0e8b6a468c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('cd5cdba6-eb40-4237-8abe-93b2aa451477', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9536c4ee-3ad8-4bc8-aeba-d546e46c9a96', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('00813bc9-ebdf-4123-abdd-13ddc863a07b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('8981c7ea-5387-4d8f-bbc7-b1e924c01789', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('265a046f-0eee-4625-aa5c-a10af66e5b08', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3889406f-286b-48ef-9ce3-b9ae76334b9d', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('16ab7c43-ac10-48b0-a6ae-913d274959b7', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b82c621b-4f35-410c-9d21-95337db6fcae', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('797a01ca-f5d9-49b6-84f0-df13d8371402', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ec9c1636-95f1-4931-bbfd-0812bfb39d1c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9fe73e7a-39b9-4305-9fe5-2f8b2d6cab08', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('7482a567-38ca-4733-afdb-562306df5e6c', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('5e5b115a-edb2-478a-b4c6-65e79ad4b00e', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('f763a59d-348f-4256-ba80-ddb1c2e4d00b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('25d4689d-6852-44a5-af63-a42839f69999', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('1f3a706c-40b5-4980-8538-80c6e191a9d0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('efe23c5a-fa99-41e9-a7c9-cae6d8130188', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3268f6a9-d998-419a-8dfd-5787cb5b227f', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('c6b9c1a8-3847-4746-8a47-75b503309463', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('9f9eedfd-df9e-4f87-ba66-2d188b9265b8', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('ae2734ab-042e-485d-8a65-030876063d99', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b6f8b21b-ec8a-4b28-a64c-8973e51cf87a', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('8888b02b-76d8-4c7d-adee-a1d587365193', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('00f544b4-f5b0-4592-be63-d35ee44633cd', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('3adaa692-69fd-4ae8-9a52-2fbc85bfbe20', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('b7433b67-30a4-4418-9a6a-b29f6208beb8', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('8643c6b8-801d-4d3b-a1ea-d04b08a9615b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('36fc6f39-4b80-4b7f-89ef-97bb4c82a7db', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('a62300c6-1b07-4990-b74b-c65a4d1c769b', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('28868702-13c7-4563-8c4a-760620a2e965', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('e4c094db-8734-404b-87e7-5814f6e45948', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('e51ccbf7-a575-4e51-b971-00517aaecec0', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00'),
	('42375aed-8d23-4020-b07c-b9de9681fb0a', 0.0000, 0.0000, '2026-05-16 01:06:43.187612+00');


--
-- Data for Name: inventory_ops_log; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: item_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: production_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: workers; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: production_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: production_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: quotation_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: stock_reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 12, true);


--
-- Name: seq_dc; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."seq_dc"', 1, false);


--
-- Name: seq_grn; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."seq_grn"', 1, false);


--
-- Name: seq_prd; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."seq_prd"', 1, false);


--
-- Name: seq_qt; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."seq_qt"', 1, false);


--
-- Name: seq_so; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."seq_so"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict UZpne27CGriA1RpwWJIqJOWRqXXLlHCA6dzAkMAVRDPuS0mO00ZIARJ66H2j7aR


-- =========================================================================
-- Multi-tenancy seed shim: backfill org_id, restore constraints
-- =========================================================================
UPDATE "public"."items"
SET "org_id" = '00000000-0000-0000-0000-000000000001'
WHERE "org_id" IS NULL;



UPDATE "public"."inventory_balance"
SET "org_id" = '00000000-0000-0000-0000-000000000001'
WHERE "org_id" IS NULL;

UPDATE "public"."profiles"
SET "org_id" = '00000000-0000-0000-0000-000000000001'
WHERE "org_id" IS NULL;

UPDATE "public"."audit_logs"
SET "org_id" = '00000000-0000-0000-0000-000000000001'
WHERE "org_id" IS NULL;

ALTER TABLE "public"."items"             ALTER COLUMN "org_id" SET NOT NULL;
ALTER TABLE "public"."inventory_balance" ALTER COLUMN "org_id" SET NOT NULL;




RESET ALL;



