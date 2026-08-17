// Import of TYPE only, erased at compile time — never needs to be
// resolved at runtime. Relative path because plugins/ is not a pnpm
// workspace member (no @workspace/types specifier resolvable here).
import type { IconPluginManifest } from "../../packages/types/src/index"

const manifest: IconPluginManifest = {
  icons: [
    { slug: "agents", name: "Agents", file: "agents.svg" },
    {
      slug: "aihypercomputer",
      name: "AI Hypercomputer",
      file: "aihypercomputer.svg",
    },
    {
      slug: "aimachinelearning",
      name: "AI Machine Learning",
      file: "aimachinelearning.svg",
    },
    { slug: "alloydb", name: "Alloy DB", file: "alloydb.svg" },
    { slug: "anthos", name: "Anthos", file: "anthos.svg" },
    { slug: "apigee", name: "Apigee", file: "apigee.svg" },
    { slug: "bigquery", name: "Big Query", file: "bigquery.svg" },
    {
      slug: "businessintelligence",
      name: "Business Intelligence",
      file: "businessintelligence.svg",
    },
    { slug: "cloud-storage", name: "Cloud Storage", file: "cloud-storage.svg" },
    { slug: "cloudrun", name: "Cloud Run", file: "cloudrun.svg" },
    { slug: "cloudspanner", name: "Cloud Spanner", file: "cloudspanner.svg" },
    { slug: "cloudsql", name: "Cloud SQL", file: "cloudsql.svg" },
    { slug: "collaboration", name: "Collaboration", file: "collaboration.svg" },
    { slug: "compute", name: "Compute", file: "compute.svg" },
    {
      slug: "computeengine",
      name: "Compute Engine",
      file: "computeengine.svg",
    },
    { slug: "containers", name: "Containers", file: "containers.svg" },
    {
      slug: "dataanalytics",
      name: "Data Analytics",
      file: "dataanalytics.svg",
    },
    { slug: "databases", name: "Databases", file: "databases.svg" },
    {
      slug: "developer-tools",
      name: "Developer Tools",
      file: "developer-tools.svg",
    },
    { slug: "devops", name: "Dev Ops", file: "devops.svg" },
    {
      slug: "distributedcloud",
      name: "Distributed Cloud",
      file: "distributedcloud.svg",
    },
    { slug: "gke", name: "GKE", file: "gke.svg" },
    {
      slug: "hybridmulticloud",
      name: "Hybrid Multicloud",
      file: "hybridmulticloud.svg",
    },
    { slug: "hyperdisk", name: "Hyperdisk", file: "hyperdisk.svg" },
    {
      slug: "integrationservices",
      name: "Integration Services",
      file: "integrationservices.svg",
    },
    { slug: "looker", name: "Looker", file: "looker.svg" },
    {
      slug: "managementtools",
      name: "Management Tools",
      file: "managementtools.svg",
    },
    { slug: "mandiant", name: "Mandiant", file: "mandiant.svg" },
    {
      slug: "mapsgeospatial",
      name: "Maps Geospatial",
      file: "mapsgeospatial.svg",
    },
    { slug: "marketplace", name: "Marketplace", file: "marketplace.svg" },
    {
      slug: "mediaservices",
      name: "Media Services",
      file: "mediaservices.svg",
    },
    { slug: "migration", name: "Migration", file: "migration.svg" },
    { slug: "mixedreality", name: "Mixed Reality", file: "mixedreality.svg" },
    { slug: "networking", name: "Networking", file: "networking.svg" },
    { slug: "observability", name: "Observability", file: "observability.svg" },
    { slug: "operations", name: "Operations", file: "operations.svg" },
    { slug: "secops", name: "Sec Ops", file: "secops.svg" },
    {
      slug: "securitycommandcenter",
      name: "Security Command Center",
      file: "securitycommandcenter.svg",
    },
    {
      slug: "securityidentity",
      name: "Security Identity",
      file: "securityidentity.svg",
    },
    {
      slug: "serverlesscomputing",
      name: "Serverless Computing",
      file: "serverlesscomputing.svg",
    },
    { slug: "storage", name: "Storage", file: "storage.svg" },
    {
      slug: "threatintelligence",
      name: "Threat Intelligence",
      file: "threatintelligence.svg",
    },
    { slug: "vertexai", name: "Vertex AI", file: "vertexai.svg" },
    { slug: "web3", name: "Web3", file: "web3.svg" },
    { slug: "webmobile", name: "Web Mobile", file: "webmobile.svg" },
  ],
}

export default manifest
