Review the **entire visual theme and design system** of the Overtime Planner you are building.

Some of the current visual design choices are poor and feel inconsistent, dated, overly decorative, or arbitrary. I do not want you to simply tweak a few colours. I want a proper **theme and visual-system audit** followed by a coherent redesign.

## Objective

Create a professional, restrained, modern visual language suitable for an internal operational planning application used by the **City of Adelaide Horticulture Department**.

The application should feel like a serious workforce and operations planning tool.

It should not feel like:

- a consumer productivity app;
- a generic AI-generated dashboard;
- a colourful startup SaaS template;
- a children's application;
- a gaming interface;
- an overly stylised HR application.

The visual design should support rapid scanning, dense operational information, tables, calendars, planning views and workforce allocation.

## Audit the current app first

Before changing anything, review the existing interface and identify problems with:

- colour palette;
- typography;
- font sizes;
- font weights;
- hierarchy;
- background colours;
- borders;
- shadows;
- corner radii;
- buttons;
- inputs;
- pills and badges;
- table styling;
- calendar styling;
- cards;
- modals and drawers;
- navigation;
- spacing;
- alignment;
- iconography;
- hover states;
- selected states;
- warning/error/success states;
- visual density;
- accessibility and contrast.

Call out design choices that are inconsistent or visually weak.

Do not preserve a bad design choice merely because it already exists.

## Colour system

Replace arbitrary colours with a deliberate, limited palette.

I want the UI to be predominantly neutral, with colour used purposefully.

Use:

- a restrained neutral background system;
- strong but not harsh text contrast;
- one primary accent colour;
- limited supporting semantic colours for success, warning, error and informational states.

Avoid:

- excessive gradients;
- bright saturated backgrounds;
- multiple competing accent colours;
- random coloured cards;
- excessive blue-on-blue or green-on-green styling;
- unnecessary coloured borders;
- decorative colour that carries no information.

Colour should primarily communicate:

- hierarchy;
- selection;
- status;
- urgency;
- availability;
- staffing gaps;
- conflicts.

Do not use colour merely to make the interface look "interesting".

## Typography

Review the fonts and typography completely.

Use a modern system or UI-oriented sans-serif font stack suitable for dense operational applications.

The typography should have a clear hierarchy for:

- page titles;
- section titles;
- table headers;
- field labels;
- body text;
- secondary metadata;
- buttons;
- badges;
- calendar labels.

Avoid:

- oversized headings;
- excessive bold text;
- very small body text;
- unnecessarily wide letter spacing;
- novelty fonts;
- multiple font families;
- weak grey text that becomes difficult to read.

Prefer a compact, highly legible interface.

## Tables

The application will rely heavily on table-based registries.

Tables should look deliberate and professional.

Review:

- row height;
- header styling;
- borders;
- zebra striping if appropriate;
- hover behaviour;
- selected rows;
- sortable headers;
- status badges;
- numeric alignment;
- date formatting;
- density.

Avoid turning every table cell into a pill, coloured box or card.

Tables should remain visually quiet so important exceptions stand out.

## Buttons and controls

Create a consistent control hierarchy.

Define clear styles for:

- primary action;
- secondary action;
- tertiary/text action;
- destructive action;
- icon-only action.

Avoid having every button compete for attention.

Reduce unnecessary borders, shadows and background colours.

Buttons should use consistent:

- height;
- padding;
- border radius;
- font weight;
- icon sizing.

The application should not contain five visually different interpretations of a button.

## Cards and panels

Use cards only when they genuinely establish information hierarchy.

Do not wrap every piece of information in an individual rounded rectangle.

Reduce excessive:

- card nesting;
- shadows;
- large corner radii;
- floating panels;
- whitespace.

Prefer clear sections, tables and subtle separators where possible.

## Corner radii and shadows

Review both globally.

The current design should not resemble a collection of soft floating bubbles.

Use modest corner radii consistently.

Use shadows sparingly, primarily where elevation genuinely matters, such as:

- menus;
- drawers;
- modals;
- floating overlays.

Normal content sections generally should not need obvious drop shadows.

## Calendar and Forward Planner

The Forward Planner is one of the strongest concepts in the application.

Its visual design should feel structured, compact and operational.

Review how:

- dates;
- weekends;
- South Australian public holidays;
- events;
- staffing status;
- conflicts;
- unstaffed jobs;
- selected records

are represented.

Do not use a rainbow of event colours.

Create a restrained visual language in which differences remain obvious without making the planner visually noisy.

The Calendar should visually align with the Forward Planner rather than appearing to come from a separate application.

## Status and semantic styling

Create a consistent semantic system for states such as:

- scheduled;
- tentative;
- fully staffed;
- partially staffed;
- unstaffed;
- unavailable;
- conflict;
- completed;
- cancelled;
- inactive employee.

Use a combination of:

- text;
- iconography;
- subtle colour;
- badges where appropriate.

Do not rely exclusively on colour.

## Spacing and density

This is an operational desktop application.

It should make good use of screen space.

Reduce unnecessary vertical padding and oversized controls.

Aim for a compact but not cramped interface.

The user should be able to see a substantial amount of operational information at once.

Do not adopt mobile-style spacing on desktop.

## Consistency

Create a small design-token system rather than continuing to style components individually.

Define reusable tokens for at least:

- primary colour;
- neutral colours;
- semantic colours;
- text colours;
- backgrounds;
- borders;
- font family;
- font sizes;
- font weights;
- spacing scale;
- control heights;
- corner radii;
- shadows.

Then refactor the UI to use these consistently.

Where possible, implement these as CSS custom properties rather than repeatedly hard-coding values.

## Accessibility

Check:

- text contrast;
- button contrast;
- focus indicators;
- selected states;
- disabled states;
- semantic colour usage;
- keyboard-visible focus;
- readability of muted text.

Do not sacrifice usability for visual minimalism.

## Design direction

The target should be:

**restrained + professional + operational + data-dense + modern**

Think more along the lines of a well-designed government operations system, GIS application, scheduling platform or enterprise planning interface.

Avoid generic "AI dashboard" aesthetics.

## Implementation approach

Do not immediately begin changing random CSS declarations.

Proceed in this order:

1. Audit the current theme.
2. Identify the worst visual inconsistencies.
3. Define a proposed visual direction.
4. Define the design tokens.
5. Define typography hierarchy.
6. Define component styling rules.
7. Apply the new theme consistently across the application.
8. Review all major screens together to ensure they look like one application.
9. Remove obsolete CSS and styling rules that conflict with the new theme.

Preserve functionality.

Do not change workflows, data models or application behaviour unless a visual issue genuinely requires a minor structural adjustment.

At the end, provide a concise summary of:

- the major visual problems you found;
- the design system you implemented;
- the key colours and typography choices;
- components you standardised;
- any remaining visual inconsistencies that still need attention.

The key requirement is **coherence**. I would prefer a simple, restrained theme executed consistently over a visually ambitious theme with poor design choices.