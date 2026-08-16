---
title: ArchiMate 3.1 Support
description: Element types, relationships, viewpoints and Open Exchange format supported by ArchiSpark.
---

ArchiSpark implements the core subset of ArchiMate 3.1 as defined by the Open Exchange Format XSDs.

## Elements

Elements are organized into **layers** (vertical separation of concerns) and **categories** (role within a layer).

### Business Layer

Represents organizational entities: actors, processes, services and business information.

| Type                    | Category          | Role                                      |
| ----------------------- | ----------------- | ----------------------------------------- |
| `BusinessActor`         | Active structure  | Executes business behavior via Assignment |
| `BusinessRole`          | Active structure  | Responsibility assigned to an actor       |
| `BusinessCollaboration` | Active structure  | Two or more actors working together       |
| `BusinessInterface`     | Active structure  | Access point for business services        |
| `BusinessProcess`       | Behaviour         | Sequence of activities producing a result |
| `BusinessFunction`      | Behaviour         | Grouping of behaviors by competence       |
| `BusinessInteraction`   | Behaviour         | Collaborative process between roles       |
| `BusinessEvent`         | Behaviour         | Triggers a process or state change        |
| `BusinessService`       | Behaviour         | Externally visible business capability    |
| `BusinessObject`        | Passive structure | Manipulated by business behavior          |
| `Contract`              | Passive structure | Formal agreement                          |
| `Representation`        | Passive structure | Perceptible form of information           |
| `Product`               | Passive structure | Coherent collection of services/objects   |

### Application Layer

Represents software: components, application services and data.

| Type                       | Category          | Role                                      |
| -------------------------- | ----------------- | ----------------------------------------- |
| `ApplicationComponent`     | Active structure  | Encapsulates application behavior         |
| `ApplicationCollaboration` | Active structure  | Cooperating components                    |
| `ApplicationInterface`     | Active structure  | Access point to application services      |
| `ApplicationProcess`       | Behaviour         | Sequence of application actions           |
| `ApplicationFunction`      | Behaviour         | Automated application behavior            |
| `ApplicationInteraction`   | Behaviour         | Collaborative application behavior        |
| `ApplicationEvent`         | Behaviour         | Application state change trigger          |
| `ApplicationService`       | Behaviour         | Externally visible application capability |
| `DataObject`               | Passive structure | Manipulated by application behavior       |

### Technology Layer

Represents infrastructure: servers, networks, system software.

| Type                      | Category          | Role                                        |
| ------------------------- | ----------------- | ------------------------------------------- |
| `Node`                    | Active structure  | Computational or physical resource          |
| `Device`                  | Active structure  | Physical computing hardware                 |
| `SystemSoftware`          | Active structure  | Software managing hardware (OS, middleware) |
| `TechnologyCollaboration` | Active structure  | Cooperating nodes                           |
| `TechnologyInterface`     | Active structure  | Access point to technology services         |
| `Path`                    | Active structure  | Communication link between nodes            |
| `CommunicationNetwork`    | Active structure  | Set of paths forming a network              |
| `TechnologyProcess`       | Behaviour         | Sequence of technology actions              |
| `TechnologyFunction`      | Behaviour         | Automated technology behavior               |
| `TechnologyInteraction`   | Behaviour         | Collaborative technology behavior           |
| `TechnologyEvent`         | Behaviour         | Technology state change trigger             |
| `TechnologyService`       | Behaviour         | Externally visible technology capability    |
| `Artifact`                | Passive structure | Data object used by technology behavior     |

### Physical Layer

Represents the physical world: equipment, facilities, materials.

| Type                  | Category          | Role                       |
| --------------------- | ----------------- | -------------------------- |
| `Equipment`           | Active structure  | Physical machine or tool   |
| `Facility`            | Active structure  | Building, site or location |
| `DistributionNetwork` | Active structure  | Physical transport network |
| `Material`            | Passive structure | Tangible physical object   |

### Motivation Layer

Represents the _why_ of architecture: stakeholders, goals and requirements.

| Type          | Description                                          |
| ------------- | ---------------------------------------------------- |
| `Stakeholder` | Person or group with an interest in the architecture |
| `Driver`      | External or internal factor motivating change        |
| `Assessment`  | Result of analysis of a driver (SWOT, risk, etc.)    |
| `Goal`        | High-level desired end state                         |
| `Outcome`     | Observable result to be achieved                     |
| `Principle`   | Normative property to guide decisions                |
| `Requirement` | Need to be met by the architecture                   |
| `Constraint`  | Restriction on implementation                        |
| `Meaning`     | Knowledge assigned to a concept                      |
| `Value`       | Importance attributed to an element                  |

### Strategy Layer

Represents _how_ the organization will achieve its goals.

| Type             | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `Resource`       | Asset (physical, informational or financial) owned or controlled |
| `Capability`     | Ability to perform a class of behaviors                          |
| `CourseOfAction` | Plan for achieving goals                                         |
| `ValueStream`    | Sequence of activities delivering value to a stakeholder         |

### Implementation & Migration Layer

Represents the transition: projects, deliverables and migration states.

| Type                  | Description                                 |
| --------------------- | ------------------------------------------- |
| `WorkPackage`         | Series of actions to achieve a result       |
| `Deliverable`         | Precisely defined result of a work package  |
| `ImplementationEvent` | Moment when a transition begins or ends     |
| `Plateau`             | Relatively stable state of the architecture |
| `Gap`                 | Difference between two plateaus             |

### Composite Elements

Cross-layer elements that can contain elements from any layer.

| Type          | Description                                       |
| ------------- | ------------------------------------------------- |
| `Grouping`    | Logical or arbitrary grouping of elements         |
| `Location`    | Physical or conceptual location                   |
| `AndJunction` | All incoming paths must arrive (AND logic)        |
| `OrJunction`  | At least one incoming path must arrive (OR logic) |

---

## Relationships

### Relationship semantics

Choose the most specific type — use `Association` only when no other type applies.

| Type             | Direction                         | Semantics                                                                                                                                   |
| ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Assignment`     | active → behavioural (same layer) | An active element is assigned to the behavioural element it performs. _Ex: BusinessActor → BusinessProcess_                                 |
| `Realization`    | lower layer → upper layer         | A more concrete element implements a more abstract one. _Ex: ApplicationService → BusinessService, TechnologyService → ApplicationService_  |
| `Serving`        | provider → consumer               | An element provides its capability for use by another. _Ex: ApplicationService → BusinessProcess, TechnologyService → ApplicationComponent_ |
| `Composition`    | whole → part (strong)             | The part cannot exist without the whole. _Ex: BusinessProcess → sub-BusinessProcess_                                                        |
| `Aggregation`    | whole → part (weak)               | The part can exist independently. _Ex: ApplicationCollaboration → ApplicationComponent_                                                     |
| `Access`         | behavioural → passive             | A behavioural element reads or writes a passive element. Always specify `access_type`. _Ex: ApplicationFunction → DataObject (ReadWrite)_   |
| `Influence`      | source → target                   | One element influences another without structuring it (often in Motivation). _Ex: Driver → Goal, Principle → BusinessProcess_               |
| `Triggering`     | trigger → triggered               | Strong causality — one behavioural element causes another. _Ex: BusinessEvent → BusinessProcess_                                            |
| `Flow`           | source → destination              | A flow of information or material between behavioural elements. _Ex: BusinessProcess → BusinessProcess (data passing)_                      |
| `Specialization` | specialized → general             | The source is a sub-type of the target. _Ex: BusinessRole → BusinessRole (SeniorManager is a Manager)_                                      |
| `Association`    | bidirectional or directed         | Generic, untyped link. Use as a last resort.                                                                                                |

### Essential modeling rules

1. **Assignment**: active element → behavioural element of the same layer
2. **Vertical realization**: Technology realizes Application, Application realizes Business (upward direction)
3. **Cross-layer serving**: `ApplicationService → BusinessProcess`, `TechnologyService → ApplicationComponent`
4. **Passive elements**: accessed via `Access` only — never assigned or triggered
5. **Prefer specificity**: choose `Assignment`, `Realization` or `Serving` before `Association`

### Special attributes

**`Access`**

- `access_type`: `"Access"` (read+write), `"Read"`, `"Write"`, `"ReadWrite"`

**`Association`**

- `is_directed`: `true` (arrow) | `false` (plain line)

**`Influence`**

- `influence_strength`: `"+"`, `"++"`, `"-"`, `"--"` or any string

---

## Viewpoints

All 28 standard ArchiMate 3.1 viewpoints are supported. A viewpoint defines the **audience** and the **element types** expected in a view.

| Viewpoint                       | Audience                      | Typical elements                                          |
| ------------------------------- | ----------------------------- | --------------------------------------------------------- |
| `Layered`                       | All stakeholders              | All layers — cross-cutting overview                       |
| `Organization`                  | Management, HR                | BusinessActor, BusinessRole, BusinessCollaboration        |
| `Business Process Cooperation`  | Business architects           | BusinessProcess, BusinessService, BusinessEvent           |
| `Product`                       | Product managers              | Product, BusinessService, BusinessActor                   |
| `Application Structure`         | Application architects        | ApplicationComponent, ApplicationInterface, DataObject    |
| `Application Usage`             | Application architects        | ApplicationComponent, ApplicationService, BusinessProcess |
| `Application Cooperation`       | Application architects        | ApplicationComponent, ApplicationService                  |
| `Application Platform`          | Application + tech architects | ApplicationComponent, Node, TechnologyService             |
| `Information Structure`         | Data architects               | BusinessObject, DataObject, Artifact                      |
| `Technology`                    | Infrastructure architects     | Node, Device, SystemSoftware, CommunicationNetwork        |
| `Technology Usage`              | Infrastructure architects     | ApplicationComponent, Node, TechnologyService             |
| `Implementation and Deployment` | Tech architects               | ApplicationComponent, Node, Artifact                      |
| `Physical`                      | Physical architects           | Equipment, Facility, DistributionNetwork                  |
| `Service Realization`           | Solution architects           | BusinessService, ApplicationService, TechnologyService    |
| `Motivation`                    | C-level, sponsors             | Stakeholder, Driver, Goal, Requirement                    |
| `Stakeholder`                   | Change managers               | Stakeholder, Driver, Assessment                           |
| `Goal Realization`              | Architects, analysts          | Goal, Requirement, Principle                              |
| `Goal Contribution`             | Architects, analysts          | Goal, Outcome                                             |
| `Principles`                    | Architects                    | Principle, Requirement                                    |
| `Requirements Realization`      | Analysts                      | Requirement, Constraint, WorkPackage                      |
| `Strategy`                      | C-level, strategy             | Capability, Resource, CourseOfAction                      |
| `Capability Map`                | C-level                       | Capability                                                |
| `Outcome Realization`           | Product owners                | Outcome, Goal, ValueStream                                |
| `Resource Map`                  | Resource managers             | Resource, Capability                                      |
| `Value Stream`                  | Business architects           | ValueStream, Capability, BusinessService                  |
| `Project`                       | Project managers              | WorkPackage, Deliverable, ImplementationEvent             |
| `Migration`                     | Change architects             | Plateau, Gap                                              |
| `Implementation and Migration`  | Program managers              | WorkPackage, Plateau, Gap, BusinessProcess                |

The `GET /viewpoints` endpoint and the `list_viewpoints` MCP tool return this list as the single source of truth.

---

## Open Exchange Format (AOEF)

ArchiSpark imports and exports the **ArchiMate Open Exchange File** format (`.xml`) defined by The Open Group.

The parser (`oxf-parser.ts`) and serializer (`oxf-serializer.ts`) preserve unmodified sections (`metadata`, `organizations`, `viewpoints`) to guarantee a lossless round-trip.

### Minimal Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="..."
       identifier="id-model-1">
  <name xml:lang="en">My model</name>
  <elements>
    <element identifier="id-1" xsi:type="ApplicationComponent">
      <name xml:lang="en">Payment Service</name>
    </element>
  </elements>
  <relationships>
    <relationship identifier="id-r1" source="id-1" target="id-2" xsi:type="Realization"/>
  </relationships>
  <views>
    <diagrams>
      <view identifier="id-v1" xsi:type="Diagram">
        <name xml:lang="en">Application view</name>
        <node identifier="id-n1" elementRef="id-1" xsi:type="Element" x="10" y="10" w="120" h="55"/>
      </view>
    </diagrams>
  </views>
</model>
```

---

## Visual Rendering (SVG)

The rendering engine implements standard ArchiMate visual shapes:

| Category            | Shape                                           |
| ------------------- | ----------------------------------------------- |
| Rectangle (default) | Active structures, passive composite structures |
| Pill / Stadium      | `*Service`                                      |
| Chevron             | `*Event`                                        |
| Hexagon             | `*Function`                                     |
| Right arrow         | `*Process`                                      |
| Two circles         | `*Collaboration`                                |
| Single circle       | `*Interface`                                    |
| Venn                | `*Interaction`                                  |
| Rectangle + line    | `DataObject`, `BusinessObject`, `Artifact`      |
| Dashed rectangle    | `Grouping`                                      |
| Filled/open circle  | `AndJunction`, `OrJunction`                     |

Background colours by layer follow the Archi reference palette:

| Layer                 | Colour                   |
| --------------------- | ------------------------ |
| Business              | `#FFFFB5` (light yellow) |
| Application           | `#B5FFFF` (light cyan)   |
| Technology / Physical | `#C9E7B7` (light green)  |
| Motivation            | `#CCCCFF` (light purple) |
| Strategy              | `#F5DEAA` (beige)        |
| Implementation        | `#FFE0E0` (light pink)   |

Setting the `archispark_image` system property on an element replaces its
notation glyph with a picked icon — see [Image Library](/docs/developer-guide/reference/image-library).
