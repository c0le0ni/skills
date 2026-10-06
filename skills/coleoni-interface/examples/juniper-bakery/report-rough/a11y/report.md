# Accessibility audit: rough

WCAG 2.2 AA · eMAG 3.1. 1 pages. 2 block people, 3 to fix, 1 worth a look, 23 rules passed.

## [Blocks people] Elements must meet minimum color contrast ratio thresholds

Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds

- WCAG: 1.4.3 Contrast (Minimum) (AA)
- eMAG: 4.1 Minimum contrast
- 17 elements on /
  - `span` <span class="eyebrow">Cakes by order</span>
  - `.lead` <p class="lead">Six flavors, three sizes and a message written by hand. Order at least 48 hours ahead and pick it up any
  - `a[href$="#pick"]` <a class="btn" href="#pick">Order a cake <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" s
  - `article:nth-child(1) > p` <p>With cream cheese and toasted walnuts.</p>
- How to fix: Element has insufficient color contrast of 3.39 (foreground color: #c9663c, background color: #f6f0e6, font size: 9.0pt (12px), font weight: bold). Expected contrast ratio of 4.5:1 (https://dequeuniversity.com/rules/axe/4.14/color-contrast?application=axeAPI)

## [Blocks people] Content does not reflow at 320px

At 320 CSS pixels wide (400% zoom on a laptop) the page scrolls sideways.

- WCAG: 1.4.10 Reflow (AA)
- eMAG: 4.3 Resizing without losing function
- 1 elements on /
  - `article.card · +230px`
- How to fix: Let the element wrap or shrink: max-width: 100%, flexible grids, overflow-x: auto on tables and code.

## [To fix] All page content should be contained by landmarks

Ensure all page content is contained by landmarks

- WCAG: best practice
- eMAG: 1.8 Divide the information areas
- 5 elements on /
  - `.hero` <section class="hero">
  - `.cards` <section class="cards">
  - `#pick` <section class="pick" id="pick">
  - `#sizes` <section class="sizes" id="sizes">
- How to fix: Some page content is not contained by landmarks (https://dequeuniversity.com/rules/axe/4.14/region?application=axeAPI)

## [To fix] Heading levels should only increase by one

Ensure the order of headings is semantically correct

- WCAG: best practice
- eMAG: 1.3 Use heading levels correctly
- 1 elements on /
  - `article:nth-child(1) > h3` <h3>Carrot</h3>
- How to fix: Heading order invalid (https://dequeuniversity.com/rules/axe/4.14/heading-order?application=axeAPI)

## [To fix] Document should have one main landmark

Ensure the document has a main landmark

- WCAG: best practice
- eMAG: 1.8 Divide the information areas
- 1 elements on /
  - `html` <html lang="en">
- How to fix: Document does not have a main landmark (https://dequeuniversity.com/rules/axe/4.14/landmark-one-main?application=axeAPI)

## [Worth a look] No skip link

The first Tab stop is not a link to the main content, so keyboard users go through the whole menu on every page.

- WCAG: 2.4.1 Bypass Blocks (A)
- eMAG: 1.5 Anchors to jump to each content block
- 1 elements on /
  - `a # “Juniper Bakery”`
- How to fix: Add “Skip to content” as the first focusable element, pointing to <main id="content">. eMAG 1.5 asks for it.

## Still to check by hand

- [ ] Read the page with a screen reader (NVDA, VoiceOver, TalkBack): does the order make sense?
- [ ] Alt text says what the image means here, not what it looks like.
- [ ] Videos have captions; audio has a transcript.
- [ ] Form errors say what went wrong and how to fix it, next to the field.
- [ ] Zoom to 200%: nothing is cut, nothing overlaps.
- [ ] Every action that works with a mouse also works with the keyboard.

Automated checks find part of the problems. The rest needs the manual pass above.