# Accessibility audit: juniperbakery.com

WCAG 2.2 AA · eMAG 3.1. 1 pages. 5 block people, 3 to fix, 2 worth a look, 26 rules passed.

## [Blocks people] Elements must meet minimum color contrast ratio thresholds

Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds

- WCAG: 1.4.3 Contrast (Minimum) (AA)
- eMAG: 4.1 Minimum contrast
- 21 elements on /
  - `header > .btn[href$="#menu"]` <a class="btn" href="#menu">Order for pickup</a>
  - `.eyebrow` <span class="eyebrow">Alberta St, Portland · open 7 to 3</span>
  - `.actions > .btn[href$="#menu"]` <a class="btn" href="#menu">See today’s menu</a>
  - `small` <small>Tuesday · 6 left</small>
- How to fix: Element has insufficient color contrast of 3.93 (foreground color: #ffffff, background color: #c8643b, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1 (https://dequeuniversity.com/rules/axe/4.14/color-contrast?application=axeAPI)

## [Blocks people] Focus is not visible

When a keyboard user tabs to these elements, nothing on screen shows where they are.

- WCAG: 2.4.7 Focus Visible (AA)
- eMAG: 4.4 Visible focus
- 11 elements on /
  - `a ./` Juniper Bakery
  - `button`
  - `a #menu` Today
  - `a #cakes` Cakes
- How to fix: Add a :focus-visible style (outline or ring) with at least 3:1 contrast against the background.

## [Blocks people] Buttons must have discernible text

Ensure buttons have discernible text

- WCAG: 4.1.2 Name, Role, Value (A)
- eMAG: 2.2 Scripted objects must be accessible
- 1 elements on /
  - `.icon-btn` <button class="icon-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F4A3A" stroke-width="2"><
- How to fix: Element does not have inner text that is visible to screen readers   aria-label attribute does not exist or is empty (https://dequeuniversity.com/rules/axe/4.14/button-name?application=axeAPI)

## [Blocks people] Images must have alternative text

Ensure <img> elements have alternative text or a role of none or presentation

- WCAG: 1.1.1 Non-text Content (A)
- eMAG: 3.6 Text alternatives for images
- 1 elements on /
  - `img` <img src="favicon.svg" width="120" height="120" style="margin-bottom:18px">
- How to fix: Element does not have an alt attribute   aria-label attribute does not exist or is empty (https://dequeuniversity.com/rules/axe/4.14/image-alt?application=axeAPI)

## [Blocks people] Content does not reflow at 320px

At 320 CSS pixels wide (400% zoom on a laptop) the page scrolls sideways.

- WCAG: 1.4.10 Reflow (AA)
- eMAG: 4.3 Resizing without losing function
- 1 elements on /
  - `div · +220px`
- How to fix: Let the element wrap or shrink: max-width: 100%, flexible grids, overflow-x: auto on tables and code.

## [To fix] All page content should be contained by landmarks

Ensure all page content is contained by landmarks

- WCAG: best practice
- eMAG: 1.8 Divide the information areas
- 10 elements on /
  - `.eyebrow` <span class="eyebrow">Alberta St, Portland · open 7 to 3</span>
  - `h1` <h1>Bread out of the oven at 7. <em>Cakes by order.</em></h1>
  - `.lead` <p class="lead">Order today’s bread before it sells out, or a cake for the weekend with 48 hours’ notice. No account, pa
  - `.promo` <div class="promo">Free cardamom bun with every cake ordered this week. Details <a href="#cakes" style="color:#F6F0E6">h
- How to fix: Some page content is not contained by landmarks (https://dequeuniversity.com/rules/axe/4.14/region?application=axeAPI)

## [To fix] Heading levels should only increase by one

Ensure the order of headings is semantically correct

- WCAG: best practice
- eMAG: 1.3 Use heading levels correctly
- 1 elements on /
  - `h4` <h4>Order before it sells out</h4>
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
  - `a ./ “Juniper Bakery”`
- How to fix: Add “Skip to content” as the first focusable element, pointing to <main id="content">. eMAG 1.5 asks for it.

## [Worth a look] Animation ignores reduced motion

With “reduce motion” on in the system, these animations still run. They can cause nausea for people with vestibular disorders.

- WCAG: 2.3.3 Animation from Interactions (AAA), 2.2.2 Pause, Stop, Hide (A)
- eMAG: 5.5 Animation control, 2.7 User control over timed changes
- 1 elements on /
  - `span.badge`
- How to fix: Wrap the animation in @media (prefers-reduced-motion: no-preference), or stop it under reduce.

## Still to check by hand

- [ ] Read the page with a screen reader (NVDA, VoiceOver, TalkBack): does the order make sense?
- [ ] Alt text says what the image means here, not what it looks like.
- [ ] Videos have captions; audio has a transcript.
- [ ] Form errors say what went wrong and how to fix it, next to the field.
- [ ] Zoom to 200%: nothing is cut, nothing overlaps.
- [ ] Every action that works with a mouse also works with the keyboard.

Automated checks find part of the problems. The rest needs the manual pass above.