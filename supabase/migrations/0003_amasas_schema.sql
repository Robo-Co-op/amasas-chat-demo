-- AMASAS data layer: schemas, tables, views, RLS, policies, grants.
-- Extracted from the source database (structure via information_schema/pg_catalog).
-- Foreign keys are added at the end of 0004, after the data is loaded.

create schema if not exists "amasas";
create schema if not exists "ai";
create schema if not exists "knowledge";

-- view bodies and FKs below reference amasas objects unqualified
-- (captured under this search_path); keep it set for the whole file.
set search_path to amasas, public;

create table "ai"."catalog" (
  "object_name" text not null,
  "description_ja" text not null,
  "usage_ja" text,
  "caveats_ja" text,
  constraint "catalog_pkey" PRIMARY KEY (object_name)
);

create table "amasas"."births_by_parity" (
  "year" bigint,
  "first_child" bigint,
  "second_child" bigint,
  "third_child" bigint,
  "fourth_child_and_above" bigint
);

create table "amasas"."business_owner_age_distribution" (
  "year" bigint,
  "display_year" text,
  "industry_category_code_name" text,
  "industry_category_code" text,
  "district_code_name" text,
  "district_code" bigint,
  "gender_code_name" text,
  "gender_code" bigint,
  "under_forties" bigint,
  "forties" bigint,
  "fifties" bigint,
  "sixties" bigint,
  "seventies" bigint,
  "over_eighties" bigint,
  "takeover_under_forties" bigint,
  "takeover_forties" bigint,
  "takeover_fifties" bigint,
  "takeover_sixties" bigint,
  "takeover_seventies" bigint,
  "takeover_over_eighties" bigint
);

create table "amasas"."business_owner_age_trend" (
  "year" bigint,
  "display_year" text,
  "industry_category_code_name" text,
  "industry_category_code" text,
  "average_age" numeric
);

create table "amasas"."cultivated_area_by_age_district" (
  "year" bigint,
  "display_year" text,
  "land_category_code_name" text,
  "land_category_code" bigint,
  "age_code_name" text,
  "age_code" bigint,
  "operator_code_name" text,
  "operator_code" bigint,
  "hishiura" bigint,
  "fukui" bigint,
  "nishi" bigint,
  "nakazato" bigint,
  "higashi" bigint,
  "kitabu" bigint,
  "uzuka" bigint,
  "toyoda" bigint,
  "hobomi" bigint,
  "chichii" bigint,
  "minami" bigint,
  "ooi" bigint,
  "saki" bigint,
  "hisuka" bigint
);

create table "amasas"."data_cards" (
  "table_name" text not null,
  "series_type" text not null,
  "unit_ja" text,
  "coverage_ja" text,
  "source_notes_ja" text,
  "caveats_ja" text,
  "typical_questions_ja" text,
  constraint "data_cards_pkey" PRIMARY KEY (table_name)
);

create table "amasas"."data_dictionary" (
  "table_name" text not null,
  "column_name" text not null,
  "label_ja" text,
  "data_type" text,
  constraint "data_dictionary_pkey" PRIMARY KEY (table_name, column_name)
);

create table "amasas"."datasets" (
  "table_name" text not null,
  "name_ja" text not null,
  "dataset_group_ja" text not null,
  "description_ja" text,
  "source_ja" text,
  "publication_status" text default '公開'::text not null,
  "origin_url" text default 'https://amaresas.town.ama.shimane.jp/'::text,
  "row_count" integer,
  "notes" text,
  constraint "datasets_pkey" PRIMARY KEY (table_name)
);

create table "amasas"."elderly_function_decline" (
  "year" bigint,
  "display_year" text,
  "age_code_name" text,
  "age_code" bigint,
  "sex_code_name" text,
  "sex_code" bigint,
  "code_name" text,
  "code" bigint,
  "people_count" bigint
);

create table "amasas"."elderly_function_decline_by_category" (
  "year" bigint,
  "display_year" text,
  "age_code_name" text,
  "age_code" bigint,
  "sex_code_name" text,
  "sex_code" bigint,
  "categorized_code_name" text,
  "categorized_code" bigint,
  "code_name" text,
  "code" bigint,
  "amacho_all" bigint
);

create table "amasas"."elderly_function_item_map" (
  "year" bigint,
  "display_year" text,
  "categorized_code_name" text,
  "categorized_code" bigint,
  "item_name" text,
  "item_code" bigint
);

create table "amasas"."elderly_function_survey_responses" (
  "year" bigint,
  "display_year" text,
  "respondent_code" bigint,
  "age_code_name" text,
  "age_code" bigint,
  "sex_code_name" text,
  "sex_code" bigint,
  "item_one" bigint,
  "item_two" bigint,
  "item_three" bigint,
  "item_four" bigint,
  "item_five" bigint,
  "item_six" bigint,
  "item_seven" bigint,
  "item_eight" bigint,
  "item_nine" bigint,
  "item_ten" bigint,
  "item_eleven" bigint,
  "item_twelve" bigint,
  "item_thirteen" bigint,
  "item_fourteen" bigint,
  "item_fifteen" bigint,
  "item_sixteen" bigint,
  "item_seventeen" bigint,
  "item_eighteen" bigint,
  "item_nineteen" bigint,
  "item_twenty" bigint,
  "item_twentyone" bigint,
  "item_twentytwo" bigint,
  "item_twentythree" bigint,
  "item_twentyfour" bigint,
  "item_twentyfive" bigint,
  "item_twentysix" numeric,
  "item_twentyseven" numeric,
  "item_twentyeight" numeric,
  "item_twentynine" numeric,
  "item_thirty" numeric
);

create table "amasas"."elderly_life_answer_map" (
  "year" bigint,
  "display_year" text,
  "life_item_code_name" text,
  "life_item_code" bigint,
  "life_answer_code_name" text,
  "life_answer_code" bigint
);

create table "amasas"."elderly_life_survey_responses" (
  "year" bigint,
  "display_year" text,
  "respondent_code" bigint,
  "age_code_name" text,
  "age_code" bigint,
  "sex_code_name" text,
  "sex_code" bigint,
  "caregiver_code_name" text,
  "caregiver_code" bigint,
  "life_function_flag" bigint,
  "exercise_flag" bigint,
  "nutrition_flag" bigint,
  "oral_flag" bigint,
  "shut_in_flag" bigint,
  "cognition_flag" bigint,
  "depression_flag" bigint,
  "item_one" bigint,
  "item_two" bigint,
  "item_three" bigint,
  "item_four" bigint,
  "item_five" bigint,
  "item_six" bigint,
  "item_seven" bigint,
  "item_eight" bigint,
  "item_nine" bigint,
  "item_ten" bigint,
  "item_eleven" bigint,
  "item_twelve" bigint,
  "item_thirteen" bigint,
  "item_fourteen" bigint,
  "item_fifteen" bigint,
  "item_sixteen" bigint,
  "item_seventeen" bigint,
  "item_eighteen" numeric,
  "item_nineteen" numeric,
  "item_twenty" numeric,
  "item_twentyone" numeric,
  "item_twentytwo" numeric,
  "item_twentythree" numeric,
  "item_twentyfour" numeric,
  "item_twentyfive" numeric,
  "item_twentysix" numeric,
  "item_twentyseven" numeric,
  "item_twentyeight" numeric,
  "item_twentynine" numeric,
  "item_thirty" numeric
);

create table "amasas"."elementary_enrollment_projection" (
  "year" bigint,
  "school_district_code_name" text,
  "school_district_code" bigint,
  "elementary_1st" bigint,
  "elementary_2nd" bigint,
  "elementary_3rd" bigint,
  "elementary_4th" bigint,
  "elementary_5th" bigint,
  "elementary_6th" bigint
);

create table "amasas"."farmers_age_by_district" (
  "year" bigint,
  "display_year" text,
  "land_category_code_name" text,
  "land_category_code" bigint,
  "age_code_name" text,
  "age_code" bigint,
  "hishiura" bigint,
  "fukui" bigint,
  "nishi" bigint,
  "nakazato" bigint,
  "higashi" bigint,
  "kitabu" bigint,
  "uzuka" bigint,
  "toyoda" bigint,
  "hobomi" bigint,
  "chichii" bigint,
  "minami" bigint,
  "ooi" bigint,
  "saki" bigint,
  "hisuka" bigint
);

create table "amasas"."farmers_age_composition" (
  "year" bigint,
  "display_year" text,
  "land_category_code_name" text,
  "land_category_code" bigint,
  "age_code_name" text,
  "age_code" bigint,
  "people" bigint
);

create table "amasas"."farmland_status_by_district" (
  "year" bigint,
  "display_year" text,
  "land_category_code_name" text,
  "land_category_code" bigint,
  "condition_code_name" text,
  "condition_code" bigint,
  "hishiura" bigint,
  "fukui" bigint,
  "nishi" bigint,
  "nakazato" bigint,
  "higashi" bigint,
  "kitabu" bigint,
  "uzuka" bigint,
  "toyoda" bigint,
  "hobomi" bigint,
  "chichii" bigint,
  "minami" bigint,
  "ooi" bigint,
  "saki" bigint,
  "hisuka" bigint
);

create table "amasas"."fertility_parity_ratio" (
  "year" text,
  "first_child" bigint,
  "second_child" bigint,
  "third_child" bigint,
  "fourth_child_and_above" bigint
);

create table "amasas"."furusato_donations_annual" (
  "year" bigint,
  "tax_payment" bigint
);

create table "amasas"."furusato_donations_by_business" (
  "year" bigint,
  "display_year" text,
  "business_code_name" text,
  "business_code" bigint,
  "tax_payment" bigint
);

create table "amasas"."furusato_donations_by_prefecture" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "area_code_name" text,
  "area_code" bigint,
  "prefecture_code_name" text,
  "prefecture_code" bigint,
  "value" bigint
);

create table "amasas"."furusato_donations_monthly" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "month" bigint,
  "display_month" text,
  "value" bigint
);

create table "amasas"."furusato_target_achievement" (
  "year" bigint,
  "display_year" text,
  "month" bigint,
  "display_month" text,
  "donate_amount" bigint,
  "target_amount" bigint
);

create table "amasas"."furusato_top10_items" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "item_code_name" text,
  "item_code" bigint,
  "value" bigint
);

create table "amasas"."furusato_top5_categories" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "category_code_name" text,
  "category_code" bigint,
  "value" bigint
);

create table "amasas"."furusato_top5_categories_monthly" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "month" bigint,
  "display_month" text,
  "ranking_code_name" text,
  "ranking_code" bigint,
  "value" bigint
);

create table "amasas"."haan_pay_usage" (
  "year" bigint,
  "display_year" text,
  "display_month" text,
  "month" bigint,
  "user_count" bigint,
  "redemption_amount" bigint
);

create table "amasas"."inbound_country_map" (
  "region_code" bigint,
  "region" text,
  "country_code" bigint,
  "display_country" text,
  "color_level" bigint
);

create table "amasas"."inbound_visitors_monthly" (
  "year" bigint,
  "display_year" text,
  "month" bigint,
  "display_month" text,
  "country_code" bigint,
  "display_country" text,
  "value" bigint
);

create table "amasas"."life_stage_trends" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "birth" bigint,
  "student" bigint,
  "employment" bigint,
  "job_relocation" bigint,
  "job_change" bigint,
  "marriage_divorce" bigint,
  "housing" bigint,
  "retirement" bigint,
  "other" bigint,
  "accompany" bigint,
  "death" bigint
);

create table "amasas"."married_couples_by_age" (
  "year" bigint,
  "teens_to_twenties" bigint,
  "thirties" bigint,
  "forties" bigint
);

create table "amasas"."migration_employment" (
  "year" bigint,
  "total" bigint,
  "increase" bigint,
  "decrease" bigint,
  "age_within14_increase" numeric,
  "age_15to34_increase" numeric,
  "age_35to64_increase" numeric,
  "age_over65_increase" numeric,
  "age_within14_decrease" numeric,
  "age_15to34_decrease" numeric,
  "age_35to64_decrease" numeric,
  "age_over65_decrease" numeric
);

create table "amasas"."migration_household_composition" (
  "year" bigint,
  "code_name" text,
  "code" bigint,
  "one_person" bigint,
  "two_people" bigint,
  "three_people" bigint,
  "four_people" bigint,
  "five_people" bigint,
  "dozen_high_students" bigint
);

create table "amasas"."migration_job_change" (
  "year" bigint,
  "total" bigint,
  "increase" bigint,
  "decrease" bigint,
  "age_within14_increase" numeric,
  "age_15to34_increase" numeric,
  "age_35to64_increase" numeric,
  "age_over65_increase" numeric,
  "age_within14_decrease" numeric,
  "age_15to34_decrease" numeric,
  "age_35to64_decrease" numeric,
  "age_over65_decrease" numeric
);

create table "amasas"."migration_retirement_family" (
  "year" bigint,
  "total" bigint,
  "increase" bigint,
  "decrease" bigint,
  "age_within14_increase" numeric,
  "age_15to34_increase" numeric,
  "age_35to64_increase" numeric,
  "age_over65_increase" numeric,
  "age_within14_decrease" numeric,
  "age_15to34_decrease" numeric,
  "age_35to64_decrease" numeric,
  "age_over65_decrease" numeric
);

create table "amasas"."migration_schooling" (
  "year" bigint,
  "total" bigint,
  "increase" bigint,
  "decrease" bigint,
  "enrollment_increase" numeric,
  "enrollment_decrease" numeric,
  "graduation_decrease" numeric
);

create table "amasas"."population_by_age_district" (
  "year" bigint,
  "display_year" text,
  "month" bigint,
  "display_month" text,
  "district_code_name" text,
  "district_code" bigint,
  "gender_code_name" text,
  "gender_code" bigint,
  "age_0to4" bigint,
  "age_5to9" bigint,
  "age_10to14" bigint,
  "age_15to19" bigint,
  "age_20to24" bigint,
  "age_25to29" bigint,
  "age_30to34" bigint,
  "age_35to39" bigint,
  "age_40to44" bigint,
  "age_45to49" bigint,
  "age_50to54" bigint,
  "age_55to59" bigint,
  "age_60to64" bigint,
  "age_65to69" bigint,
  "age_70to74" bigint,
  "age_75to79" bigint,
  "age_80to84" bigint,
  "age_85to89" bigint,
  "age_over90" bigint
);

create table "amasas"."reference_queries" (
  "query_id" text not null,
  "question_ja" text not null,
  "description_ja" text,
  "sql_text" text not null,
  "guardrail_notes_ja" text,
  constraint "reference_queries_pkey" PRIMARY KEY (query_id)
);

create table "amasas"."school_district_child_population" (
  "year" bigint,
  "display_year" text,
  "code_name" text,
  "code" bigint,
  "age_code_name" text,
  "age_code" bigint,
  "ama_elementary" bigint,
  "fukui_elementary" bigint
);

create table "amasas"."strategy_kpi" (
  "strategy_period" integer not null,
  "period_start" integer,
  "period_end" integer,
  "basic_goal" text,
  "policy" text,
  "kpi_name" text,
  "target_label" text,
  "target_value" numeric,
  "unit" text,
  "direction" text,
  "plan_value" numeric,
  "fiscal_year" integer,
  "actual_value" numeric,
  "drill_url" text
);

create table "amasas"."tourist_visitors_by_spot" (
  "year" bigint,
  "display_year" text,
  "month" bigint,
  "display_month" text,
  "place_code" bigint,
  "display_place" text,
  "value" bigint
);

create table "knowledge"."involvement_paths" (
  "path_key" text not null,
  "path_ja" text not null,
  "description_ja" text not null,
  "target_profile_ja" text,
  "pillar_no" integer,
  "kpi_ja" text,
  "source_ref" text,
  constraint "involvement_paths_pkey" PRIMARY KEY (path_key)
);

create table "knowledge"."map_assets" (
  "asset_key" text not null,
  "doc_ref" text not null,
  "title_ja" text not null,
  "page" integer not null,
  "public_url" text,
  "description_ja" text not null,
  "caveat_ja" text,
  "updated_at" timestamptz default now() not null,
  constraint "map_assets_pkey" PRIMARY KEY (asset_key)
);

create table "knowledge"."measures" (
  "measure_key" text not null,
  "name_ja" text not null,
  "definition_ja" text not null,
  "caveat_ja" text,
  "priority" integer default 100 not null,
  "publisher" text,
  "url" text,
  "verification" text,
  "verified_on" date,
  constraint "measures_pkey" PRIMARY KEY (measure_key),
  constraint "measures_verification_check" CHECK ((verification = ANY (ARRAY['verified'::text, 'partially_verified'::text, 'unverified'::text, 'circular'::text, 'private'::text, 'internal'::text])))
);

create table "knowledge"."reading_playbook" (
  "entry_key" text not null,
  "kind" text not null,
  "name_ja" text not null,
  "question_ja" text,
  "how_ja" text not null,
  "example_ja" text,
  "caveat_ja" text,
  "moves" text[],
  "frame_hint_ja" text,
  "output_shape_ja" text,
  "source_ref" text not null,
  "priority" integer,
  constraint "reading_playbook_kind_check" CHECK ((kind = ANY (ARRAY['observation'::text, 'interpretation'::text, 'pattern'::text]))),
  constraint "reading_playbook_pkey" PRIMARY KEY (entry_key)
);

create table "knowledge"."source_registry" (
  "source_key" text not null,
  "name_ja" text not null,
  "publisher" text default '海士町'::text not null,
  "published_on" date,
  "url" text,
  "verification" text not null,
  "verified_on" date,
  "note_ja" text,
  "updated_at" timestamptz default now() not null,
  constraint "source_registry_verification_check" CHECK ((verification = ANY (ARRAY['verified'::text, 'unverified'::text, 'circular'::text, 'private'::text, 'unavailable'::text]))),
  constraint "source_registry_pkey" PRIMARY KEY (source_key)
);

create table "knowledge"."strategy_frames" (
  "frame" text not null,
  "industries_ja" text not null,
  "policy_stance_ja" text not null,
  "guardrail_ja" text not null,
  "kpi_ja" text,
  "related_tables" text[],
  "source_ref" text,
  constraint "strategy_frames_pkey" PRIMARY KEY (frame)
);

create table "knowledge"."strategy_pillars" (
  "pillar_no" integer not null,
  "pillar_ja" text not null,
  "aim_ja" text not null,
  "key_actions_ja" text not null,
  "targets_ja" text not null,
  "actors_ja" text not null,
  "source_ref" text,
  constraint "strategy_pillars_pkey" PRIMARY KEY (pillar_no)
);

create table "knowledge"."town_facts" (
  "fact_key" text not null,
  "statement_ja" text not null,
  "measure_key" text,
  "source_ja" text not null,
  "year_label" text,
  "priority" integer default 100 not null,
  "source_ref" text,
  "valid_from" date default CURRENT_DATE not null,
  "updated_at" timestamptz default now() not null,
  "kind" text default 'fact'::text not null,
  "caveat_ja" text,
  constraint "town_facts_pkey" PRIMARY KEY (fact_key),
  constraint "town_facts_kind_check" CHECK ((kind = ANY (ARRAY['fact'::text, 'unknown'::text, 'assumption'::text])))
);

create or replace view "ai"."districts" as
 SELECT DISTINCT district_code AS code,
    district_code_name AS name
   FROM population_by_age_district
  ORDER BY district_code;

create or replace view "amasas"."v_population_long" as
 SELECT population_by_age_district.year,
    population_by_age_district.display_year,
    population_by_age_district.month,
    population_by_age_district.district_code_name AS district_ja,
    population_by_age_district.gender_code_name AS gender_ja,
    x.age_group_ja,
    x.population
   FROM population_by_age_district,
    LATERAL ( VALUES ('0-4歳'::text,population_by_age_district.age_0to4), ('5-9歳'::text,population_by_age_district.age_5to9), ('10-14歳'::text,population_by_age_district.age_10to14), ('15-19歳'::text,population_by_age_district.age_15to19), ('20-24歳'::text,population_by_age_district.age_20to24), ('25-29歳'::text,population_by_age_district.age_25to29), ('30-34歳'::text,population_by_age_district.age_30to34), ('35-39歳'::text,population_by_age_district.age_35to39), ('40-44歳'::text,population_by_age_district.age_40to44), ('45-49歳'::text,population_by_age_district.age_45to49), ('50-54歳'::text,population_by_age_district.age_50to54), ('55-59歳'::text,population_by_age_district.age_55to59), ('60-64歳'::text,population_by_age_district.age_60to64), ('65-69歳'::text,population_by_age_district.age_65to69), ('70-74歳'::text,population_by_age_district.age_70to74), ('75-79歳'::text,population_by_age_district.age_75to79), ('80-84歳'::text,population_by_age_district.age_80to84), ('85-89歳'::text,population_by_age_district.age_85to89), ('90歳以上'::text,population_by_age_district.age_over90)) x(age_group_ja, population);

create or replace view "amasas"."v_farmland_long" as
 SELECT farmland_status_by_district.year,
    farmland_status_by_district.display_year,
    farmland_status_by_district.land_category_code_name AS land_category_ja,
    farmland_status_by_district.condition_code_name AS condition_ja,
    x.district_ja,
    x.area
   FROM farmland_status_by_district,
    LATERAL ( VALUES ('菱浦'::text,farmland_status_by_district.hishiura), ('福井'::text,farmland_status_by_district.fukui), ('西'::text,farmland_status_by_district.nishi), ('中里'::text,farmland_status_by_district.nakazato), ('東'::text,farmland_status_by_district.higashi), ('北分'::text,farmland_status_by_district.kitabu), ('宇受賀'::text,farmland_status_by_district.uzuka), ('豊田'::text,farmland_status_by_district.toyoda), ('保々見'::text,farmland_status_by_district.hobomi), ('知々井'::text,farmland_status_by_district.chichii), ('御波'::text,farmland_status_by_district.minami), ('多井'::text,farmland_status_by_district.ooi), ('崎'::text,farmland_status_by_district.saki), ('日須賀'::text,farmland_status_by_district.hisuka)) x(district_ja, area);

create or replace view "amasas"."v_farmers_age_long" as
 SELECT farmers_age_by_district.year,
    farmers_age_by_district.display_year,
    farmers_age_by_district.land_category_code_name AS land_category_ja,
    farmers_age_by_district.age_code_name AS age_group_ja,
    x.district_ja,
    x.people
   FROM farmers_age_by_district,
    LATERAL ( VALUES ('菱浦'::text,farmers_age_by_district.hishiura), ('福井'::text,farmers_age_by_district.fukui), ('西'::text,farmers_age_by_district.nishi), ('中里'::text,farmers_age_by_district.nakazato), ('東'::text,farmers_age_by_district.higashi), ('北分'::text,farmers_age_by_district.kitabu), ('宇受賀'::text,farmers_age_by_district.uzuka), ('豊田'::text,farmers_age_by_district.toyoda), ('保々見'::text,farmers_age_by_district.hobomi), ('知々井'::text,farmers_age_by_district.chichii), ('御波'::text,farmers_age_by_district.minami), ('多井'::text,farmers_age_by_district.ooi), ('崎'::text,farmers_age_by_district.saki), ('日須賀'::text,farmers_age_by_district.hisuka)) x(district_ja, people);

create or replace view "amasas"."v_cultivated_area_long" as
 SELECT cultivated_area_by_age_district.year,
    cultivated_area_by_age_district.display_year,
    cultivated_area_by_age_district.land_category_code_name AS land_category_ja,
    cultivated_area_by_age_district.age_code_name AS age_group_ja,
    cultivated_area_by_age_district.operator_code_name AS operator_ja,
    x.district_ja,
    x.area
   FROM cultivated_area_by_age_district,
    LATERAL ( VALUES ('菱浦'::text,cultivated_area_by_age_district.hishiura), ('福井'::text,cultivated_area_by_age_district.fukui), ('西'::text,cultivated_area_by_age_district.nishi), ('中里'::text,cultivated_area_by_age_district.nakazato), ('東'::text,cultivated_area_by_age_district.higashi), ('北分'::text,cultivated_area_by_age_district.kitabu), ('宇受賀'::text,cultivated_area_by_age_district.uzuka), ('豊田'::text,cultivated_area_by_age_district.toyoda), ('保々見'::text,cultivated_area_by_age_district.hobomi), ('知々井'::text,cultivated_area_by_age_district.chichii), ('御波'::text,cultivated_area_by_age_district.minami), ('多井'::text,cultivated_area_by_age_district.ooi), ('崎'::text,cultivated_area_by_age_district.saki), ('日須賀'::text,cultivated_area_by_age_district.hisuka)) x(district_ja, area);

create or replace view "amasas"."v_strategy_kpi_progress" as
 SELECT strategy_period,
    basic_goal,
    policy,
    kpi_name,
    unit,
    direction,
    target_value,
    plan_value,
    fiscal_year,
    actual_value,
        CASE
            WHEN actual_value IS NULL OR target_value IS NULL THEN NULL::boolean
            WHEN direction = '減少'::text THEN target_value >= actual_value
            ELSE actual_value >= target_value
        END AS target_met
   FROM strategy_kpi;

create or replace view "amasas"."v_town_overview" as
 WITH latest_pop AS (
         SELECT v_population_long.year,
            v_population_long.month
           FROM v_population_long
          ORDER BY v_population_long.year DESC, v_population_long.month DESC
         LIMIT 1
        )
 SELECT '人口'::text AS "分野",
    '総人口'::text AS "指標",
    sum(p.population) AS "値",
    '人'::text AS "単位",
    max(p.year)::integer AS "年",
    '住民生活課・住民基本台帳'::text AS "出典"
   FROM v_population_long p
     JOIN latest_pop l ON p.year = l.year AND p.month = l.month
UNION ALL
 SELECT '人口'::text AS "分野",
    '高齢化率'::text AS "指標",
    round(100.0 * sum(p.population) FILTER (WHERE p.age_group_ja = ANY (ARRAY['65-69歳'::text, '70-74歳'::text, '75-79歳'::text, '80-84歳'::text, '85-89歳'::text, '90歳以上'::text])) / sum(p.population), 1) AS "値",
    '%'::text AS "単位",
    max(p.year)::integer AS "年",
    '住民生活課・住民基本台帳'::text AS "出典"
   FROM v_population_long p
     JOIN latest_pop l ON p.year = l.year AND p.month = l.month
UNION ALL
 SELECT '人口'::text AS "分野",
    '年少人口(0-14歳)'::text AS "指標",
    sum(p.population) FILTER (WHERE p.age_group_ja = ANY (ARRAY['0-4歳'::text, '5-9歳'::text, '10-14歳'::text])) AS "値",
    '人'::text AS "単位",
    max(p.year)::integer AS "年",
    '住民生活課・住民基本台帳'::text AS "出典"
   FROM v_population_long p
     JOIN latest_pop l ON p.year = l.year AND p.month = l.month
UNION ALL
 SELECT '人口動態'::text AS "分野",
    '人口純増減(直近年)'::text AS "指標",
    (life_stage_trends.birth + life_stage_trends.student + life_stage_trends.employment + life_stage_trends.job_relocation + life_stage_trends.job_change + life_stage_trends.marriage_divorce + life_stage_trends.housing + life_stage_trends.retirement + life_stage_trends.other + life_stage_trends.accompany + life_stage_trends.death)::numeric AS "値",
    '人'::text AS "単位",
    life_stage_trends.year::integer AS "年",
    '住民生活課'::text AS "出典"
   FROM life_stage_trends
  WHERE life_stage_trends.code_name = '純増減数'::text AND life_stage_trends.year = (( SELECT max(life_stage_trends_1.year) AS max
           FROM life_stage_trends life_stage_trends_1))
UNION ALL
 SELECT '出生・結婚'::text AS "分野",
    '年間出生数'::text AS "指標",
    (births_by_parity.first_child + births_by_parity.second_child + births_by_parity.third_child + births_by_parity.fourth_child_and_above)::numeric AS "値",
    '人'::text AS "単位",
    births_by_parity.year::integer AS "年",
    '住民生活課'::text AS "出典"
   FROM births_by_parity
  WHERE births_by_parity.year = (( SELECT max(births_by_parity_1.year) AS max
           FROM births_by_parity births_by_parity_1))
UNION ALL
 SELECT '出生・結婚'::text AS "分野",
    '結婚した夫婦世帯数'::text AS "指標",
    (married_couples_by_age.teens_to_twenties + married_couples_by_age.thirties + married_couples_by_age.forties)::numeric AS "値",
    '組'::text AS "単位",
    married_couples_by_age.year::integer AS "年",
    '住民生活課'::text AS "出典"
   FROM married_couples_by_age
  WHERE married_couples_by_age.year = (( SELECT max(married_couples_by_age_1.year) AS max
           FROM married_couples_by_age married_couples_by_age_1))
UNION ALL
 SELECT 'ふるさと納税'::text AS "分野",
    '年間寄付金額'::text AS "指標",
    furusato_donations_annual.tax_payment::numeric AS "値",
    '円'::text AS "単位",
    furusato_donations_annual.year::integer AS "年",
    '海士町役場'::text AS "出典"
   FROM furusato_donations_annual
  WHERE furusato_donations_annual.year = (( SELECT max(furusato_donations_annual_1.year) AS max
           FROM furusato_donations_annual furusato_donations_annual_1))
UNION ALL
 SELECT '観光'::text AS "分野",
    '観光地点入込客延べ数(年計)'::text AS "指標",
    sum(tourist_visitors_by_spot.value) AS "値",
    '人'::text AS "単位",
    tourist_visitors_by_spot.year::integer AS "年",
    '交流促進課'::text AS "出典"
   FROM tourist_visitors_by_spot
  WHERE tourist_visitors_by_spot.year = (( SELECT max(tourist_visitors_by_spot_1.year) AS max
           FROM tourist_visitors_by_spot tourist_visitors_by_spot_1))
  GROUP BY tourist_visitors_by_spot.year
UNION ALL
 SELECT '地域通貨'::text AS "分野",
    'ハーンPayユーザー数(最新月)'::text AS "指標",
    h.user_count::numeric AS "値",
    '人'::text AS "単位",
    h.year::integer AS "年",
    '海士町役場'::text AS "出典"
   FROM ( SELECT haan_pay_usage.year,
            haan_pay_usage.display_year,
            haan_pay_usage.display_month,
            haan_pay_usage.month,
            haan_pay_usage.user_count,
            haan_pay_usage.redemption_amount
           FROM haan_pay_usage
          ORDER BY haan_pay_usage.year DESC, haan_pay_usage.month DESC
         LIMIT 1) h
UNION ALL
 SELECT '総合戦略'::text AS "分野",
    '第2期KPI 達成/未達/未集計'::text AS "指標",
    count(*) FILTER (WHERE v_strategy_kpi_progress.target_met)::numeric AS "値",
    ((('達成数(未達'::text || count(*) FILTER (WHERE v_strategy_kpi_progress.target_met = false)) || '/未集計'::text) || count(*) FILTER (WHERE v_strategy_kpi_progress.target_met IS NULL)) || ')'::text AS "単位",
    2024 AS "年",
    '海士町総合戦略'::text AS "出典"
   FROM v_strategy_kpi_progress
  WHERE v_strategy_kpi_progress.strategy_period = 2
UNION ALL
 SELECT '高齢者福祉'::text AS "分野",
    '生活機能低下の傾向あり'::text AS "指標",
    sum(elderly_function_decline.people_count) AS "値",
    '人(回答者ベース)'::text AS "単位",
    2023 AS "年",
    '健康福祉課'::text AS "出典"
   FROM elderly_function_decline
  WHERE elderly_function_decline.code_name = '低下の傾向あり'::text
UNION ALL
 SELECT '農業'::text AS "分野",
    '耕作放棄地の割合'::text AS "指標",
    round(100.0 * sum(v_farmland_long.area) FILTER (WHERE v_farmland_long.condition_ja ~~ '耕作放棄地%'::text) / NULLIF(sum(v_farmland_long.area), 0::numeric), 1) AS "値",
    '%'::text AS "単位",
    max(v_farmland_long.year)::integer AS "年",
    '地産地商課'::text AS "出典"
   FROM v_farmland_long
  WHERE v_farmland_long.year = (( SELECT max(v_farmland_long_1.year) AS max
           FROM v_farmland_long v_farmland_long_1));

create or replace view "ai"."codebooks" as
 SELECT 'インバウンド対象国'::text AS code_type,
    inbound_country_map.country_code AS code,
    inbound_country_map.display_country AS label,
    inbound_country_map.region AS extra
   FROM inbound_country_map
UNION ALL
 SELECT '生活機能項目'::text AS code_type,
    elderly_function_item_map.item_code AS code,
    elderly_function_item_map.item_name AS label,
    elderly_function_item_map.categorized_code_name AS extra
   FROM elderly_function_item_map
UNION ALL
 SELECT '生活項目の回答選択肢'::text AS code_type,
    elderly_life_answer_map.life_answer_code AS code,
    elderly_life_answer_map.life_answer_code_name AS label,
    elderly_life_answer_map.life_item_code_name AS extra
   FROM elderly_life_answer_map;

create or replace view "ai"."facts" as
 SELECT 'population'::text AS dataset,
    '人口'::text AS metric,
    v_population_long.year,
    NULL::text AS period_label,
    NULL::integer AS month,
    v_population_long.district_ja AS district,
    v_population_long.gender_ja AS gender,
    v_population_long.age_group_ja AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    v_population_long.population::numeric AS value,
    '人'::text AS unit,
    '住民生活課・住民基本台帳(各年1月1日時点)'::text AS source
   FROM v_population_long
  WHERE v_population_long.month = 1
UNION ALL
 SELECT 'life_stage'::text AS dataset,
    ('人口動態('::text || l.code_name) || ')'::text AS metric,
    l.year,
    NULL::text AS period_label,
    NULL::integer AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    x.reason AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '人'::text AS unit,
    '住民生活課'::text AS source
   FROM life_stage_trends l,
    LATERAL ( VALUES ('出生'::text,l.birth), ('就学・卒業'::text,l.student), ('就職'::text,l.employment), ('転勤'::text,l.job_relocation), ('転職・転業'::text,l.job_change), ('結婚・離婚等'::text,l.marriage_divorce), ('住宅'::text,l.housing), ('退職・家族の事情'::text,l.retirement), ('その他'::text,l.other), ('同伴者'::text,l.accompany), ('死亡'::text,l.death)) x(reason, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'births'::text AS dataset,
    '出生数'::text AS metric,
    b.year,
    NULL::text AS period_label,
    NULL::integer AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    x.parity AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '人'::text AS unit,
    '住民生活課'::text AS source
   FROM births_by_parity b,
    LATERAL ( VALUES ('第1子'::text,b.first_child), ('第2子'::text,b.second_child), ('第3子'::text,b.third_child), ('第4子以上'::text,b.fourth_child_and_above)) x(parity, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'fertility'::text AS dataset,
    '夫婦出生子供数割合'::text AS metric,
    NULL::bigint AS year,
    f.year AS period_label,
    NULL::integer AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    x.parity AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '%'::text AS unit,
    '住民生活課'::text AS source
   FROM fertility_parity_ratio f,
    LATERAL ( VALUES ('第1子'::text,f.first_child), ('第2子'::text,f.second_child), ('第3子'::text,f.third_child), ('第4子以上'::text,f.fourth_child_and_above)) x(parity, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'marriages'::text AS dataset,
    '結婚夫婦世帯数'::text AS metric,
    m.year,
    NULL::text AS period_label,
    NULL::integer AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    x.age_band AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '組'::text AS unit,
    '住民生活課'::text AS source
   FROM married_couples_by_age m,
    LATERAL ( VALUES ('20代以下'::text,m.teens_to_twenties), ('30代'::text,m.thirties), ('40代'::text,m.forties)) x(age_band, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'households'::text AS dataset,
    '転入転出世帯数'::text AS metric,
    h.year,
    NULL::text AS period_label,
    NULL::integer AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    x.size AS category,
    h.code_name AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '世帯'::text AS unit,
    '住民生活課'::text AS source
   FROM migration_household_composition h,
    LATERAL ( VALUES ('1人'::text,h.one_person), ('2人'::text,h.two_people), ('3人'::text,h.three_people), ('4人'::text,h.four_people), ('5人'::text,h.five_people), ('島前高校生'::text,h.dozen_high_students)) x(size, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    'ふるさと納税寄付金額(年次)'::text AS metric,
    furusato_donations_annual.year,
    NULL::text AS period_label,
    NULL::integer AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    furusato_donations_annual.tax_payment::numeric AS value,
    '円'::text AS unit,
    '海士町役場'::text AS source
   FROM furusato_donations_annual
UNION ALL
 SELECT 'furusato'::text AS dataset,
    ('ふるさと納税寄付'::text || furusato_donations_monthly.code_name) || '(月次)'::text AS metric,
    furusato_donations_monthly.year,
    NULL::text AS period_label,
    furusato_donations_monthly.month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    furusato_donations_monthly.value::numeric AS value,
        CASE
            WHEN furusato_donations_monthly.code_name = '金額'::text THEN '円'::text
            ELSE '件'::text
        END AS unit,
    '海士町役場'::text AS source
   FROM furusato_donations_monthly
  WHERE furusato_donations_monthly.value IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    'ふるさと納税月次'::text || x.name AS metric,
    t.year,
    NULL::text AS period_label,
    t.month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '円'::text AS unit,
    '海士町役場'::text AS source
   FROM furusato_target_achievement t,
    LATERAL ( VALUES ('寄付金額'::text,t.donate_amount), ('目標金額'::text,t.target_amount)) x(name, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    'ふるさと納税充当額'::text AS metric,
    furusato_donations_by_business.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    furusato_donations_by_business.business_code_name AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    furusato_donations_by_business.tax_payment::numeric AS value,
    '円'::text AS unit,
    '海士町役場'::text AS source
   FROM furusato_donations_by_business
  WHERE furusato_donations_by_business.tax_payment IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    ('ふるさと納税都道府県別('::text || furusato_donations_by_prefecture.code_name) || ')'::text AS metric,
    furusato_donations_by_prefecture.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    furusato_donations_by_prefecture.area_code_name AS category,
    NULL::text AS subcategory,
    furusato_donations_by_prefecture.prefecture_code_name AS item,
    furusato_donations_by_prefecture.value::numeric AS value,
        CASE
            WHEN furusato_donations_by_prefecture.code_name ~~ '%金額%'::text THEN '円'::text
            WHEN furusato_donations_by_prefecture.code_name ~~ '%人数%'::text THEN '人'::text
            ELSE '件'::text
        END AS unit,
    '海士町役場'::text AS source
   FROM furusato_donations_by_prefecture
  WHERE furusato_donations_by_prefecture.value IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    ('返礼品カテゴリ別('::text || furusato_top5_categories.code_name) || ')'::text AS metric,
    furusato_top5_categories.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    furusato_top5_categories.category_code_name AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    furusato_top5_categories.value::numeric AS value,
        CASE
            WHEN furusato_top5_categories.code_name = '金額'::text THEN '円'::text
            ELSE '件'::text
        END AS unit,
    '海士町役場'::text AS source
   FROM furusato_top5_categories
  WHERE furusato_top5_categories.value IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    ('返礼品別('::text || furusato_top10_items.code_name) || ')'::text AS metric,
    furusato_top10_items.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    furusato_top10_items.item_code_name AS item,
    furusato_top10_items.value::numeric AS value,
        CASE
            WHEN furusato_top10_items.code_name = '金額'::text THEN '円'::text
            ELSE '件'::text
        END AS unit,
    '海士町役場'::text AS source
   FROM furusato_top10_items
  WHERE furusato_top10_items.value IS NOT NULL
UNION ALL
 SELECT 'furusato'::text AS dataset,
    ('返礼品カテゴリ別月次('::text || furusato_top5_categories_monthly.code_name) || ')'::text AS metric,
    furusato_top5_categories_monthly.year,
    NULL::text AS period_label,
    furusato_top5_categories_monthly.month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    furusato_top5_categories_monthly.ranking_code_name AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    furusato_top5_categories_monthly.value::numeric AS value,
        CASE
            WHEN furusato_top5_categories_monthly.code_name = '金額'::text THEN '円'::text
            ELSE '件'::text
        END AS unit,
    '海士町役場'::text AS source
   FROM furusato_top5_categories_monthly
  WHERE furusato_top5_categories_monthly.value IS NOT NULL
UNION ALL
 SELECT 'school_district'::text AS dataset,
    '校区別年少人口'::text AS metric,
    s.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    s.age_code_name AS age_group,
    s.code_name AS category,
    NULL::text AS subcategory,
    x.school AS item,
    x.val::numeric AS value,
    '人'::text AS unit,
    '住民生活課'::text AS source
   FROM school_district_child_population s,
    LATERAL ( VALUES ('海士小'::text,s.ama_elementary), ('福井小'::text,s.fukui_elementary)) x(school, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'school_projection'::text AS dataset,
    '小学校児童数(将来推計)'::text AS metric,
    e.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    e.school_district_code_name AS category,
    x.grade AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '人'::text AS unit,
    '住民生活課(推計値・実績ではない)'::text AS source
   FROM elementary_enrollment_projection e,
    LATERAL ( VALUES ('1年生'::text,e.elementary_1st), ('2年生'::text,e.elementary_2nd), ('3年生'::text,e.elementary_3rd), ('4年生'::text,e.elementary_4th), ('5年生'::text,e.elementary_5th), ('6年生'::text,e.elementary_6th)) x(grade, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'business_owner'::text AS dataset,
    x.metric,
    b.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    b.district_code_name AS district,
    b.gender_code_name AS gender,
    x.age_band AS age_group,
    b.industry_category_code_name AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
    '人'::text AS unit,
    '海士町役場'::text AS source
   FROM business_owner_age_distribution b,
    LATERAL ( VALUES ('経営者数'::text,'40歳未満'::text,b.under_forties), ('経営者数'::text,'40代'::text,b.forties), ('経営者数'::text,'50代'::text,b.fifties), ('経営者数'::text,'60代'::text,b.sixties), ('経営者数'::text,'70代'::text,b.seventies), ('経営者数'::text,'80歳以上'::text,b.over_eighties), ('事業承継者数'::text,'40歳未満'::text,b.takeover_under_forties), ('事業承継者数'::text,'40代'::text,b.takeover_forties), ('事業承継者数'::text,'50代'::text,b.takeover_fifties), ('事業承継者数'::text,'60代'::text,b.takeover_sixties), ('事業承継者数'::text,'70代'::text,b.takeover_seventies), ('事業承継者数'::text,'80歳以上'::text,b.takeover_over_eighties)) x(metric, age_band, val)
  WHERE x.val IS NOT NULL
UNION ALL
 SELECT 'business_owner'::text AS dataset,
    '経営者平均年齢'::text AS metric,
    business_owner_age_trend.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    business_owner_age_trend.industry_category_code_name AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    business_owner_age_trend.average_age AS value,
    '歳'::text AS unit,
    '海士町役場'::text AS source
   FROM business_owner_age_trend
  WHERE business_owner_age_trend.average_age IS NOT NULL
UNION ALL
 SELECT 'farmland'::text AS dataset,
    '農地面積'::text AS metric,
    v_farmland_long.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    v_farmland_long.district_ja AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    v_farmland_long.land_category_ja AS category,
    v_farmland_long.condition_ja AS subcategory,
    NULL::text AS item,
    v_farmland_long.area::numeric AS value,
    '面積(単位は元データ未記載・相対比較用)'::text AS unit,
    '地産地商課'::text AS source
   FROM v_farmland_long
  WHERE v_farmland_long.area IS NOT NULL
UNION ALL
 SELECT 'farmers'::text AS dataset,
    '農業担い手数'::text AS metric,
    v_farmers_age_long.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    v_farmers_age_long.district_ja AS district,
    NULL::text AS gender,
    v_farmers_age_long.age_group_ja AS age_group,
    v_farmers_age_long.land_category_ja AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    v_farmers_age_long.people::numeric AS value,
    '人'::text AS unit,
    '地産地商課'::text AS source
   FROM v_farmers_age_long
  WHERE v_farmers_age_long.people IS NOT NULL
UNION ALL
 SELECT 'farmland'::text AS dataset,
    '耕作農地面積'::text AS metric,
    v_cultivated_area_long.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    v_cultivated_area_long.district_ja AS district,
    NULL::text AS gender,
    v_cultivated_area_long.age_group_ja AS age_group,
    v_cultivated_area_long.land_category_ja AS category,
    v_cultivated_area_long.operator_ja AS subcategory,
    NULL::text AS item,
    v_cultivated_area_long.area::numeric AS value,
    '面積(単位は元データ未記載・相対比較用)'::text AS unit,
    '地産地商課'::text AS source
   FROM v_cultivated_area_long
  WHERE v_cultivated_area_long.area IS NOT NULL
UNION ALL
 SELECT 'elderly'::text AS dataset,
    '生活機能低下傾向者数'::text AS metric,
    elderly_function_decline_by_category.year,
    NULL::text AS period_label,
    NULL::bigint AS month,
    NULL::text AS district,
    elderly_function_decline_by_category.sex_code_name AS gender,
    elderly_function_decline_by_category.age_code_name AS age_group,
    elderly_function_decline_by_category.categorized_code_name AS category,
    elderly_function_decline_by_category.code_name AS subcategory,
    NULL::text AS item,
    elderly_function_decline_by_category.amacho_all::numeric AS value,
    '人(回答者ベース)'::text AS unit,
    '健康福祉課(基本チェックリスト)'::text AS source
   FROM elderly_function_decline_by_category
  WHERE elderly_function_decline_by_category.categorized_code_name <> '全て'::text AND elderly_function_decline_by_category.amacho_all IS NOT NULL
UNION ALL
 SELECT 'tourism'::text AS dataset,
    '観光地点入込客数'::text AS metric,
    tourist_visitors_by_spot.year,
    NULL::text AS period_label,
    tourist_visitors_by_spot.month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    tourist_visitors_by_spot.display_place AS item,
    tourist_visitors_by_spot.value::numeric AS value,
    '人(延べ)'::text AS unit,
    '交流促進課'::text AS source
   FROM tourist_visitors_by_spot
  WHERE tourist_visitors_by_spot.value IS NOT NULL
UNION ALL
 SELECT 'tourism'::text AS dataset,
    'インバウンド来訪者数'::text AS metric,
    inbound_visitors_monthly.year,
    NULL::text AS period_label,
    inbound_visitors_monthly.month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    inbound_visitors_monthly.display_country AS item,
    inbound_visitors_monthly.value::numeric AS value,
    '人'::text AS unit,
    '交流促進課'::text AS source
   FROM inbound_visitors_monthly
  WHERE inbound_visitors_monthly.value IS NOT NULL
UNION ALL
 SELECT 'haan_pay'::text AS dataset,
    'ハーンPay'::text || x.name AS metric,
    h.year,
    NULL::text AS period_label,
    h.month,
    NULL::text AS district,
    NULL::text AS gender,
    NULL::text AS age_group,
    NULL::text AS category,
    NULL::text AS subcategory,
    NULL::text AS item,
    x.val::numeric AS value,
        CASE
            WHEN x.name = 'ユーザー数'::text THEN '人'::text
            ELSE '円'::text
        END AS unit,
    '海士町役場'::text AS source
   FROM haan_pay_usage h,
    LATERAL ( VALUES ('ユーザー数'::text,h.user_count), ('総入金額'::text,h.redemption_amount)) x(name, val)
  WHERE x.val IS NOT NULL;

create or replace view "ai"."kpis" as
 SELECT strategy_period,
    period_start,
    period_end,
    basic_goal,
    policy,
    kpi_name,
    target_label,
    target_value,
    unit,
    direction,
    plan_value,
    fiscal_year,
    actual_value,
        CASE
            WHEN actual_value IS NULL OR target_value IS NULL THEN NULL::boolean
            WHEN direction = '減少'::text THEN target_value >= actual_value
            ELSE actual_value >= target_value
        END AS target_met,
    drill_url
   FROM strategy_kpi;

create or replace view "ai"."population_trend" as
 SELECT year AS "年",
    sum(population) AS "総人口",
    round(100.0 * sum(population) FILTER (WHERE age_group_ja = ANY (ARRAY['65-69歳'::text, '70-74歳'::text, '75-79歳'::text, '80-84歳'::text, '85-89歳'::text, '90歳以上'::text])) / sum(population), 1) AS "高齢化率_pct",
    round(100.0 * sum(population) FILTER (WHERE age_group_ja = ANY (ARRAY['15-19歳'::text, '20-24歳'::text, '25-29歳'::text, '30-34歳'::text])) / sum(population), 1) AS "若年比率_15_34_pct"
   FROM v_population_long
  WHERE month = 1
  GROUP BY year
  ORDER BY year;

create or replace view "ai"."town_overview_latest" as
 SELECT "分野",
    "指標",
    "値",
    "単位",
    "年",
    "出典"
   FROM v_town_overview;

create or replace view "ai"."elderly_life_summary" as
 SELECT year,
    caregiver_code_name AS caregiver,
    age_code_name AS age_group,
    sex_code_name AS gender,
    count(*) AS respondents,
    sum(life_function_flag) AS "生活機能全般_該当",
    sum(exercise_flag) AS "運動_該当",
    sum(nutrition_flag) AS "栄養_該当",
    sum(oral_flag) AS "口腔_該当",
    sum(shut_in_flag) AS "閉じこもり_該当",
    sum(cognition_flag) AS "認知_該当",
    sum(depression_flag) AS "うつ_該当"
   FROM elderly_life_survey_responses
  GROUP BY year, caregiver_code_name, age_code_name, sex_code_name
 HAVING count(*) >= 10;

create or replace view "ai"."restructuring_kpis" as
 SELECT strategy_period,
    basic_goal,
    policy,
    kpi_name,
    unit,
    direction,
    target_value,
    fiscal_year,
    actual_value,
    target_met
   FROM v_strategy_kpi_progress
  WHERE strategy_period = 4;

alter table "ai"."catalog" enable row level security;
alter table "amasas"."births_by_parity" enable row level security;
alter table "amasas"."business_owner_age_distribution" enable row level security;
alter table "amasas"."business_owner_age_trend" enable row level security;
alter table "amasas"."cultivated_area_by_age_district" enable row level security;
alter table "amasas"."data_cards" enable row level security;
alter table "amasas"."data_dictionary" enable row level security;
alter table "amasas"."datasets" enable row level security;
alter table "amasas"."elderly_function_decline" enable row level security;
alter table "amasas"."elderly_function_decline_by_category" enable row level security;
alter table "amasas"."elderly_function_item_map" enable row level security;
alter table "amasas"."elderly_function_survey_responses" enable row level security;
alter table "amasas"."elderly_life_answer_map" enable row level security;
alter table "amasas"."elderly_life_survey_responses" enable row level security;
alter table "amasas"."elementary_enrollment_projection" enable row level security;
alter table "amasas"."farmers_age_by_district" enable row level security;
alter table "amasas"."farmers_age_composition" enable row level security;
alter table "amasas"."farmland_status_by_district" enable row level security;
alter table "amasas"."fertility_parity_ratio" enable row level security;
alter table "amasas"."furusato_donations_annual" enable row level security;
alter table "amasas"."furusato_donations_by_business" enable row level security;
alter table "amasas"."furusato_donations_by_prefecture" enable row level security;
alter table "amasas"."furusato_donations_monthly" enable row level security;
alter table "amasas"."furusato_target_achievement" enable row level security;
alter table "amasas"."furusato_top10_items" enable row level security;
alter table "amasas"."furusato_top5_categories" enable row level security;
alter table "amasas"."furusato_top5_categories_monthly" enable row level security;
alter table "amasas"."haan_pay_usage" enable row level security;
alter table "amasas"."inbound_country_map" enable row level security;
alter table "amasas"."inbound_visitors_monthly" enable row level security;
alter table "amasas"."life_stage_trends" enable row level security;
alter table "amasas"."married_couples_by_age" enable row level security;
alter table "amasas"."migration_employment" enable row level security;
alter table "amasas"."migration_household_composition" enable row level security;
alter table "amasas"."migration_job_change" enable row level security;
alter table "amasas"."migration_retirement_family" enable row level security;
alter table "amasas"."migration_schooling" enable row level security;
alter table "amasas"."population_by_age_district" enable row level security;
alter table "amasas"."reference_queries" enable row level security;
alter table "amasas"."school_district_child_population" enable row level security;
alter table "amasas"."strategy_kpi" enable row level security;
alter table "amasas"."tourist_visitors_by_spot" enable row level security;

create policy "amasas_read_only" on "amasas"."elderly_life_survey_responses" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."strategy_kpi" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."datasets" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."data_dictionary" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."inbound_visitors_monthly" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."migration_household_composition" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."migration_job_change" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_top5_categories" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_top10_items" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."migration_retirement_family" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."inbound_country_map" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_top5_categories_monthly" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_donations_by_business" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."elderly_function_decline_by_category" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."farmers_age_by_district" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."farmland_status_by_district" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."fertility_parity_ratio" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_donations_monthly" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_donations_by_prefecture" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."cultivated_area_by_age_district" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."farmers_age_composition" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."school_district_child_population" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."married_couples_by_age" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."elderly_function_survey_responses" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."elderly_function_decline" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."elderly_function_item_map" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."haan_pay_usage" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."life_stage_trends" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."population_by_age_district" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."births_by_parity" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_donations_annual" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."elementary_enrollment_projection" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."migration_schooling" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."migration_employment" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."elderly_life_answer_map" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."furusato_target_achievement" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."business_owner_age_distribution" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."business_owner_age_trend" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."tourist_visitors_by_spot" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."data_cards" for select to "anon", "authenticated" using (true);
create policy "amasas_read_only" on "amasas"."reference_queries" for select to "anon", "authenticated" using (true);
create policy "ai_read_only" on "ai"."catalog" for select to "anon", "authenticated" using (true);

grant usage on schema "amasas", "ai", "knowledge" to anon, authenticated;
grant select on all tables in schema "amasas" to anon, authenticated;
grant select on all tables in schema "ai" to anon, authenticated;
grant select on all tables in schema "knowledge" to anon, authenticated;
