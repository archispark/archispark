-- Renames the archispark_image system property definition: both its stable
-- uuid (property_def_uuid) and its displayed name change. property_def_uuid
-- on element_properties/relationship_properties isn't a DB-level foreign
-- key (see schema.ts), so it must be updated explicitly alongside the
-- property_definitions row it logically refers to.
UPDATE "element_properties"
SET "property_def_uuid" = 'archispark-plugin-iconpack'
WHERE "property_def_uuid" = 'archispark-image';
--> statement-breakpoint
UPDATE "relationship_properties"
SET "property_def_uuid" = 'archispark-plugin-iconpack'
WHERE "property_def_uuid" = 'archispark-image';
--> statement-breakpoint
UPDATE "property_definitions"
SET "uuid" = 'archispark-plugin-iconpack', "name" = 'Archispark Plugin IconPack'
WHERE "uuid" = 'archispark-image';
