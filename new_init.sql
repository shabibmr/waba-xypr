--
-- PostgreSQL database dump
--

\restrict uLGA3mYeAoATmxADJDbCQup1lz9bZbxlW85hhbp5BzelbiiNx0YUKYWbqGvPYt1

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversation_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_assignments (
    assignment_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    tenant_id character varying(50) NOT NULL,
    assigned_at timestamp without time zone DEFAULT now(),
    last_activity_at timestamp without time zone DEFAULT now(),
    status character varying(50) DEFAULT 'active'::character varying
);


ALTER TABLE public.conversation_assignments OWNER TO postgres;

--
-- Name: conversation_context; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_context (
    conversation_id character varying(100) NOT NULL,
    context jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversation_context OWNER TO postgres;

--
-- Name: conversation_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wa_id character varying(50) NOT NULL,
    conversation_id character varying(100),
    communication_id character varying(100),
    last_message_id character varying(255),
    contact_name character varying(255),
    phone_number_id character varying(50),
    display_phone_number character varying(50),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    last_activity_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb,
    CONSTRAINT conversation_mappings_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'closed'::character varying, 'expired'::character varying])::text[])))
);


ALTER TABLE public.conversation_mappings OWNER TO postgres;

--
-- Name: genesys_user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.genesys_user_sessions (
    session_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    is_active boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.genesys_user_sessions OWNER TO postgres;

--
-- Name: genesys_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.genesys_users (
    user_id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id character varying(50) NOT NULL,
    genesys_user_id character varying(255) NOT NULL,
    genesys_email character varying(255),
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'agent'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_login_at timestamp without time zone,
    is_active boolean DEFAULT true
);


ALTER TABLE public.genesys_users OWNER TO postgres;

--
-- Name: message_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mapping_id uuid NOT NULL,
    wamid character varying(255),
    genesys_message_id character varying(100),
    direction character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'received'::character varying NOT NULL,
    media_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    delivered_at timestamp without time zone,
    metadata jsonb,
    CONSTRAINT message_tracking_direction_check CHECK (((direction)::text = ANY ((ARRAY['INBOUND'::character varying, 'OUTBOUND'::character varying])::text[])))
);


ALTER TABLE public.message_tracking OWNER TO postgres;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pgmigrations_id_seq OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: tenant_api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_api_keys (
    api_key character varying(100) NOT NULL,
    tenant_id character varying(50),
    name character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_used timestamp without time zone
);


ALTER TABLE public.tenant_api_keys OWNER TO postgres;

--
-- Name: tenant_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_credentials (
    id integer NOT NULL,
    tenant_id character varying(50),
    credential_type character varying(50) NOT NULL,
    credentials jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tenant_credentials OWNER TO postgres;

--
-- Name: tenant_credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tenant_credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tenant_credentials_id_seq OWNER TO postgres;

--
-- Name: tenant_credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tenant_credentials_id_seq OWNED BY public.tenant_credentials.id;


--
-- Name: tenant_whatsapp_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_whatsapp_config (
    id integer NOT NULL,
    tenant_id character varying(50),
    waba_id character varying(100) NOT NULL,
    phone_number_id character varying(100) NOT NULL,
    access_token text NOT NULL,
    business_id character varying(100),
    display_phone_number character varying(50),
    quality_rating character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    business_account_id character varying(100),
    verify_token character varying(255),
    configured boolean DEFAULT true
);


ALTER TABLE public.tenant_whatsapp_config OWNER TO postgres;

--
-- Name: tenant_whatsapp_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tenant_whatsapp_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tenant_whatsapp_config_id_seq OWNER TO postgres;

--
-- Name: tenant_whatsapp_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tenant_whatsapp_config_id_seq OWNED BY public.tenant_whatsapp_config.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    tenant_id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    subdomain character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    plan character varying(50) DEFAULT 'standard'::character varying,
    rate_limit integer DEFAULT 100,
    genesys_org_id character varying(100),
    genesys_org_name character varying(255),
    genesys_region character varying(100),
    onboarding_completed boolean DEFAULT false,
    onboarding_completed_at timestamp without time zone,
    whatsapp_configured boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb,
    phone_number_id character varying(255),
    genesys_integration_id character varying(255),
    email text,
    domain text,
    settings jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: tenant_credentials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_credentials ALTER COLUMN id SET DEFAULT nextval('public.tenant_credentials_id_seq'::regclass);


--
-- Name: tenant_whatsapp_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_whatsapp_config ALTER COLUMN id SET DEFAULT nextval('public.tenant_whatsapp_config_id_seq'::regclass);


--
-- Name: conversation_assignments conversation_assignments_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_assignments conversation_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: conversation_context conversation_context_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_context
    ADD CONSTRAINT conversation_context_pkey PRIMARY KEY (conversation_id);


--
-- Name: conversation_mappings conversation_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_mappings
    ADD CONSTRAINT conversation_mappings_pkey PRIMARY KEY (id);


--
-- Name: genesys_user_sessions genesys_user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genesys_user_sessions
    ADD CONSTRAINT genesys_user_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: genesys_users genesys_users_genesys_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genesys_users
    ADD CONSTRAINT genesys_users_genesys_user_id_key UNIQUE (genesys_user_id);


--
-- Name: genesys_users genesys_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genesys_users
    ADD CONSTRAINT genesys_users_pkey PRIMARY KEY (user_id);


--
-- Name: message_tracking message_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_tracking
    ADD CONSTRAINT message_tracking_pkey PRIMARY KEY (id);


--
-- Name: message_tracking message_tracking_wamid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_tracking
    ADD CONSTRAINT message_tracking_wamid_key UNIQUE (wamid);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: tenant_api_keys tenant_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_pkey PRIMARY KEY (api_key);


--
-- Name: tenant_credentials tenant_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_credentials
    ADD CONSTRAINT tenant_credentials_pkey PRIMARY KEY (id);


--
-- Name: tenant_whatsapp_config tenant_whatsapp_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_whatsapp_config
    ADD CONSTRAINT tenant_whatsapp_config_pkey PRIMARY KEY (id);


--
-- Name: tenant_whatsapp_config tenant_whatsapp_config_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_whatsapp_config
    ADD CONSTRAINT tenant_whatsapp_config_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenants tenants_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_email_key UNIQUE (email);


--
-- Name: tenants tenants_genesys_integration_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_genesys_integration_id_key UNIQUE (genesys_integration_id);


--
-- Name: tenants tenants_phone_number_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_phone_number_id_key UNIQUE (phone_number_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenants tenants_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subdomain_key UNIQUE (subdomain);


--
-- Name: idx_conversation_assignments_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_assignments_conversation ON public.conversation_assignments USING btree (conversation_id);


--
-- Name: idx_conversation_assignments_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_assignments_tenant ON public.conversation_assignments USING btree (tenant_id);


--
-- Name: idx_conversation_assignments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_assignments_user ON public.conversation_assignments USING btree (user_id);


--
-- Name: idx_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversation_id ON public.conversation_mappings USING btree (conversation_id);


--
-- Name: idx_genesys_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_genesys_message_id ON public.message_tracking USING btree (genesys_message_id);


--
-- Name: idx_genesys_user_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_genesys_user_sessions_user ON public.genesys_user_sessions USING btree (user_id);


--
-- Name: idx_genesys_users_genesys_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_genesys_users_genesys_id ON public.genesys_users USING btree (genesys_user_id);


--
-- Name: idx_genesys_users_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_genesys_users_tenant ON public.genesys_users USING btree (tenant_id);


--
-- Name: idx_last_activity_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_last_activity_at ON public.conversation_mappings USING btree (last_activity_at);


--
-- Name: idx_last_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_last_message_id ON public.conversation_mappings USING btree (last_message_id);


--
-- Name: idx_mapping_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mapping_id ON public.message_tracking USING btree (mapping_id);


--
-- Name: idx_mt_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mt_created_at ON public.message_tracking USING btree (created_at);


--
-- Name: idx_mt_direction; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mt_direction ON public.message_tracking USING btree (direction);


--
-- Name: idx_mt_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mt_status ON public.message_tracking USING btree (status);


--
-- Name: idx_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_status ON public.conversation_mappings USING btree (status);


--
-- Name: idx_tenant_creds_tenant_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_creds_tenant_type ON public.tenant_credentials USING btree (tenant_id, credential_type);


--
-- Name: idx_tenant_genesys_integration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_genesys_integration_id ON public.tenants USING btree (genesys_integration_id);


--
-- Name: idx_tenant_phone_number_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_phone_number_id ON public.tenants USING btree (phone_number_id);


--
-- Name: idx_tenant_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_status ON public.tenants USING btree (status);


--
-- Name: idx_tenant_subdomain; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_subdomain ON public.tenants USING btree (subdomain);


--
-- Name: idx_tenant_waba; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_waba ON public.tenant_whatsapp_config USING btree (tenant_id);


--
-- Name: idx_tenants_genesys_integration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenants_genesys_integration_id ON public.tenants USING btree (genesys_integration_id);


--
-- Name: idx_tenants_phone_number_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenants_phone_number_id ON public.tenants USING btree (phone_number_id);


--
-- Name: idx_unique_active_mapping; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_unique_active_mapping ON public.conversation_mappings USING btree (wa_id) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_wa_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_id ON public.conversation_mappings USING btree (wa_id);


--
-- Name: idx_wamid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_wamid ON public.message_tracking USING btree (wamid);


--
-- Name: tenants_genesys_integration_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenants_genesys_integration_id_index ON public.tenants USING btree (genesys_integration_id);


--
-- Name: tenants_phone_number_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenants_phone_number_id_index ON public.tenants USING btree (phone_number_id);


--
-- Name: tenants update_tenants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversation_assignments conversation_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: conversation_assignments conversation_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_assignments
    ADD CONSTRAINT conversation_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.genesys_users(user_id) ON DELETE CASCADE;


--
-- Name: genesys_user_sessions genesys_user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genesys_user_sessions
    ADD CONSTRAINT genesys_user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.genesys_users(user_id) ON DELETE CASCADE;


--
-- Name: genesys_users genesys_users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.genesys_users
    ADD CONSTRAINT genesys_users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: message_tracking message_tracking_mapping_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_tracking
    ADD CONSTRAINT message_tracking_mapping_id_fkey FOREIGN KEY (mapping_id) REFERENCES public.conversation_mappings(id) ON DELETE CASCADE;


--
-- Name: tenant_api_keys tenant_api_keys_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_credentials tenant_credentials_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_credentials
    ADD CONSTRAINT tenant_credentials_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_whatsapp_config tenant_whatsapp_config_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_whatsapp_config
    ADD CONSTRAINT tenant_whatsapp_config_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO postgres;


--
-- PostgreSQL database dump complete
--

\unrestrict uLGA3mYeAoATmxADJDbCQup1lz9bZbxlW85hhbp5BzelbiiNx0YUKYWbqGvPYt1

