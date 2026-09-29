I am designing an **Overtime Planner** for the Horticulture Department at the City of Adelaide's labour depot.

The application needs to support both short-term overtime scheduling and long-range workforce planning. Some overtime requirements are known well in advance, and it should be practical to forward-plan recurring overtime commitments **several years into the future**.

## Operational context

Overtime work is usually undertaken on:

- Saturdays
- Sundays

However, overtime can also occur on:

- Fridays
- Mondays

This is particularly relevant around **South Australian public holidays**, where operational requirements may shift work onto adjoining days.

The planner therefore cannot assume that overtime is exclusively weekend work.

## Types of overtime work

The system needs to accommodate different types of overtime commitments:

1. **Annual recurring events**
   - Events that occur once every year.
   - Their exact date may vary from year to year.
   - They should be capable of being forward-planned across multiple years.

2. **Regularly scheduled work**
   - Recurring overtime requirements that may follow a predictable schedule or frequency.

3. **One-off events**
   - Events or operational requirements that occur only once.

The system should distinguish between an **event/job definition** and the individual scheduled occurrences of that work. For example, an annual event should not require users to manually create an entirely new job record every year.

## Forward Planner

I already have a **Forward Planner** concept in the application and I like this part of the design.

Preserve and build upon the Forward Planner.

It should become one of the application's primary planning views and make it easy to understand:

- upcoming overtime commitments;
- recurring commitments across multiple years;
- workload by month, quarter and year;
- which work has staff assigned;
- which work still requires staffing;
- anticipated overtime demand;
- conflicts or periods of unusually high overtime demand.

Do not unnecessarily replace or radically redesign the Forward Planner if its existing concepts can be retained and improved.

## Calendar redesign

The current calendar needs to be reconsidered.

Design the calendar specifically around **overtime planning**, rather than treating it as a generic calendar.

It should clearly distinguish:

- scheduled overtime;
- unstaffed overtime;
- annual events;
- recurring work;
- one-off work;
- Saturdays and Sundays;
- South Australian public holidays;
- Friday/Monday overtime associated with public holiday periods.

Consider whether month, year and multi-year views are useful.

The calendar and Forward Planner should complement each other rather than duplicate the same interface.

## Job Registry redesign

The existing Job Registry needs to be substantially reworked.

I strongly prefer a **table-based registry rather than a card-based registry**.

The Job Registry should behave more like an operational data register, with:

- sortable columns;
- filters;
- search;
- status;
- recurrence;
- event/job type;
- responsible team;
- dates or scheduling rules;
- staffing requirements;
- expected duration/hours;
- forward-planning information;
- quick access to edit/view details.

Design the table so that large numbers of jobs can be scanned efficiently.

Avoid oversized cards and excessive whitespace.

Consider expandable table rows or a detail drawer where additional information is required.

## Staff Registry

Add a dedicated **Overtime Staff Registry**.

There is an existing **user table** that will be uploaded to the application regularly.

This user table should act as an authoritative workforce reference and help determine:

- who currently works at the City of Adelaide labour depot;
- who has left the organisation/depot;
- new employees;
- employee identifiers;
- team membership;
- other useful workforce attributes available in the source data.

Do not simply delete historical employees when they disappear from a newly uploaded user table.

Instead, preserve historical overtime records while marking those employees as no longer active/available.

The Staff Registry should allow the application to distinguish between:

- active depot employees;
- inactive/former employees;
- employees who are available for overtime;
- employees who are temporarily unavailable for overtime;
- employees who are eligible for particular categories of overtime work.

## Overtime eligibility

Staff eligibility should be strongly influenced by **team suitability**.

Different horticulture teams may be better suited to different types of overtime work.

The application should therefore support relationships such as:

**Job / task type → preferred or eligible team → eligible employees**

However, avoid making this unnecessarily rigid.

There may be circumstances where someone outside the preferred team can perform the work.

Design an eligibility model that can support concepts such as:

- preferred team;
- eligible teams;
- eligible individual employees;
- exclusions;
- temporary availability;
- manual override where authorised.

The planner should make it obvious why a staff member is or is not considered suitable for an overtime assignment.

## Staff allocation

The planner needs to support assigning employees to overtime jobs.

When planning an overtime event, users should be able to see:

- number of staff required;
- staff already allocated;
- remaining vacancies;
- eligible staff;
- unavailable staff;
- employees already committed to another overtime job;
- relevant team;
- expected overtime hours.

Consider whether the interface should also expose historical overtime distribution so planners can avoid repeatedly assigning overtime to the same employees.

Do not make automatic assignment decisions unless explicitly designed as an optional planning aid. The final staffing decision should remain with the planner.

## Historical integrity

Historical records are important.

Changes to:

- employee status;
- team membership;
- job definitions;
- recurring schedules

must not rewrite historical overtime records.

For example, if an employee moves from one team to another, historical overtime records should continue to show the team/context applicable at the time where appropriate.

## Core application structure

Review the overall information architecture.

A likely structure is:

- **Forward Planner**
- **Calendar**
- **Job Registry**
- **Staff Registry**
- **Overtime Allocations / Assignments**
- **Settings / Data Import**

These do not necessarily need to be separate pages if a better information architecture is available.

## Design priorities

The application should feel like an operational workforce-planning system rather than a generic HR application.

Prioritise:

1. rapid scanning of information;
2. table-based interfaces for registries;
3. long-range planning;
4. simple staff allocation;
5. clear warnings for staffing gaps and conflicts;
6. preservation of historical data;
7. recurring event management;
8. workforce changes driven by the regularly uploaded user table;
9. minimal duplicate data entry;
10. clear relationships between jobs, occurrences, teams and employees.

## What I want you to do

Review the existing application against these requirements and propose a coherent redesign.

First determine the correct **data model, relationships and business rules**, then design the interface around them.

Pay particular attention to separating these concepts correctly:

- Job / Event
- Recurrence definition
- Scheduled occurrence
- Overtime requirement
- Staff member
- Team
- Eligibility
- Availability
- Staff assignment

Do not collapse these into a single record if separating them produces a more robust system.

Provide:

1. a proposed information architecture;
2. the core data model and relationships;
3. recommended business rules;
4. a redesigned Job Registry;
5. a Staff Registry design;
6. a redesigned overtime-specific Calendar;
7. improvements to the existing Forward Planner;
8. a recommended staff allocation workflow;
9. treatment of recurring/annual events and multi-year planning;
10. treatment of the regularly uploaded user table and departed employees;
11. important edge cases or conflicts I may not yet have considered.

Where the existing application already has a good concept—particularly the **Forward Planner**—preserve it rather than redesigning for the sake of change.