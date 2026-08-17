import { andJunction } from "./and-junction.js"
import { applicationCollaboration } from "./application-collaboration.js"
import { applicationComponent } from "./application-component.js"
import { applicationEvent } from "./application-event.js"
import { applicationFunction } from "./application-function.js"
import { applicationInteraction } from "./application-interaction.js"
import { applicationInterface } from "./application-interface.js"
import { applicationProcess } from "./application-process.js"
import { applicationService } from "./application-service.js"
import { artifact } from "./artifact.js"
import { assessment } from "./assessment.js"
import { businessActor } from "./business-actor.js"
import { businessCollaboration } from "./business-collaboration.js"
import { businessEvent } from "./business-event.js"
import { businessFunction } from "./business-function.js"
import { businessInteraction } from "./business-interaction.js"
import { businessInterface } from "./business-interface.js"
import { businessObject } from "./business-object.js"
import { businessProcess } from "./business-process.js"
import { businessRole } from "./business-role.js"
import { businessService } from "./business-service.js"
import { capability } from "./capability.js"
import { communicationNetwork } from "./communication-network.js"
import { constraint } from "./constraint.js"
import { contract } from "./contract.js"
import { courseOfAction } from "./course-of-action.js"
import { dataObject } from "./data-object.js"
import { deliverable } from "./deliverable.js"
import { device } from "./device.js"
import { distributionNetwork } from "./distribution-network.js"
import { driver } from "./driver.js"
import { equipment } from "./equipment.js"
import { facility } from "./facility.js"
import { gap } from "./gap.js"
import { goal } from "./goal.js"
import { grouping } from "./grouping.js"
import { implementationEvent } from "./implementation-event.js"
import { junction } from "./junction.js"
import { location } from "./location.js"
import { material } from "./material.js"
import { meaning } from "./meaning.js"
import { node } from "./node.js"
import { orJunction } from "./or-junction.js"
import { outcome } from "./outcome.js"
import { path } from "./path.js"
import { plateau } from "./plateau.js"
import { principle } from "./principle.js"
import { product } from "./product.js"
import { representation } from "./representation.js"
import { requirement } from "./requirement.js"
import { resource } from "./resource.js"
import { stakeholder } from "./stakeholder.js"
import { systemSoftware } from "./system-software.js"
import { technologyCollaboration } from "./technology-collaboration.js"
import { technologyEvent } from "./technology-event.js"
import { technologyFunction } from "./technology-function.js"
import { technologyInteraction } from "./technology-interaction.js"
import { technologyInterface } from "./technology-interface.js"
import { technologyProcess } from "./technology-process.js"
import { technologyService } from "./technology-service.js"
import { value } from "./value.js"
import { valueStream } from "./value-stream.js"
import { workPackage } from "./work-package.js"
import type { SystemArchimateIcon } from "../types.js"

export const SYSTEM_ARCHIMATE_ICONS: SystemArchimateIcon[] = [
  andJunction,
  applicationCollaboration,
  applicationComponent,
  applicationEvent,
  applicationFunction,
  applicationInteraction,
  applicationInterface,
  applicationProcess,
  applicationService,
  artifact,
  assessment,
  businessActor,
  businessCollaboration,
  businessEvent,
  businessFunction,
  businessInteraction,
  businessInterface,
  businessObject,
  businessProcess,
  businessRole,
  businessService,
  capability,
  communicationNetwork,
  constraint,
  contract,
  courseOfAction,
  dataObject,
  deliverable,
  device,
  distributionNetwork,
  driver,
  equipment,
  facility,
  gap,
  goal,
  grouping,
  implementationEvent,
  junction,
  location,
  material,
  meaning,
  node,
  orJunction,
  outcome,
  path,
  plateau,
  principle,
  product,
  representation,
  requirement,
  resource,
  stakeholder,
  systemSoftware,
  technologyCollaboration,
  technologyEvent,
  technologyFunction,
  technologyInteraction,
  technologyInterface,
  technologyProcess,
  technologyService,
  value,
  valueStream,
  workPackage,
]

export function getSystemArchimateIcon(
  slug: string
): SystemArchimateIcon | undefined {
  return SYSTEM_ARCHIMATE_ICONS.find((icon) => icon.slug === slug)
}
