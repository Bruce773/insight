import { boolean, doublePrecision, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
}, (table) => [primaryKey({ columns: [table.identifier, table.token] })]);

export const occupations = pgTable("occupations", {
  code: text("code").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  jobZone: integer("job_zone"),
});

export const occupationRatings = pgTable("occupation_ratings", {
  occupationCode: text("occupation_code").notNull().references(() => occupations.code, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  elementName: text("element_name").notNull(),
  scaleId: text("scale_id").notNull(),
  value: doublePrecision("value").notNull(),
  source: text("source").notNull(),
}, (table) => [primaryKey({ columns: [table.occupationCode, table.elementId, table.scaleId] })]);

export const occInterests = pgTable("occ_interests", {
  occupationCode: text("occupation_code").notNull().references(() => occupations.code, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  elementName: text("element_name").notNull(),
  scaleId: text("scale_id").notNull(),
  rawValue: doublePrecision("raw_value").notNull(),
  value: doublePrecision("value"),
  source: text("source").notNull(),
}, (table) => [primaryKey({ columns: [table.occupationCode, table.elementId, table.scaleId] })]);

export const occWorkStyles = pgTable("occ_work_styles", {
  occupationCode: text("occupation_code").notNull().references(() => occupations.code, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  elementName: text("element_name").notNull(),
  scaleId: text("scale_id").notNull(),
  rawValue: doublePrecision("raw_value").notNull(),
  value: doublePrecision("value"),
  source: text("source").notNull(),
}, (table) => [primaryKey({ columns: [table.occupationCode, table.elementId, table.scaleId] })]);

export const occRequirements = pgTable("occ_requirements", {
  occupationCode: text("occupation_code").notNull().references(() => occupations.code, { onDelete: "cascade" }),
  elementId: text("element_id").notNull(),
  elementName: text("element_name").notNull(),
  scaleId: text("scale_id").notNull(),
  rawValue: doublePrecision("raw_value").notNull(),
  value: doublePrecision("value"),
  source: text("source").notNull(),
}, (table) => [primaryKey({ columns: [table.occupationCode, table.elementId, table.scaleId] })]);

export const occupationDemand = pgTable("occ_demand", {
  occupationCode: text("occupation_code").notNull().references(() => occupations.code, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  value: doublePrecision("value").notNull(),
  unit: text("unit").notNull().default(""),
  year: integer("year").notNull().default(0),
  source: text("source").notNull(),
}, (table) => [primaryKey({ columns: [table.occupationCode, table.metric, table.unit, table.year, table.source] })]);

export const assessmentItems = pgTable("items", {
  id: text("id").primaryKey(),
  instrument: text("instrument").notNull(),
  text: text("text").notNull(),
  domain: text("domain"),
  facet: text("facet"),
  reverseKeyed: boolean("reverse_keyed"),
  responseMin: doublePrecision("response_min"),
  responseMax: doublePrecision("response_max"),
  source: text("source").notNull(),
});

export const assessmentResults = pgTable("assessment_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const responses = pgTable("responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => assessmentItems.id, { onDelete: "cascade" }),
  value: jsonb("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  occupationCode: text("occupation_code").notNull().references(() => occupations.code, { onDelete: "cascade" }),
  score: doublePrecision("score"),
  components: jsonb("components").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const skillPlans = pgTable("skill_plan", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const items = assessmentItems;
export const occDemand = occupationDemand;
