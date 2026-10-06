# Juniper Bakery: scope

**Client:** Juniper Bakery (Nora Lindqvist, owner)
**Prepared by:** Coleoni
**Version:** 0.1, from the briefing of October 6
**Status:** draft for review

## 1. Summary

Today almost every order arrives by WhatsApp. On Saturday mornings that means
60 to 90 messages before 10am, read and answered by hand, with nothing that
says what has to be ready and when. Cake orders, which need 48 hours, get lost
in the chat.

This project replaces the chat as the place where orders live: a simple order
page for customers, a single list of the day's orders for the counter, and a
WhatsApp confirmation so nothing depends on scrolling back.

In one sentence: no order, and above all no cake, gets lost again.

## 2. The problem

**The pain that justifies the project** (*What went wrong recently?*): orders
buried in WhatsApp are forgotten. Last Saturday two cakes were missed, one for
a birthday; the customer was refunded and lost. It happens every few weeks.

Other pains in the briefing:

- Customers ask all day whether a product is available today. **In the first
  release**, as a daily availability switch.
- No online payment. **Out for now**: paying at pickup works today (call notes).
- Wholesale orders copied from email to a Sheet. **Out**: Nora says it is not a
  problem.

## 3. First release

### Order page (customers, on the phone)

- Today's menu: name, photo, price and an "available today" state set by the
  counter.
- Cakes as a separate section: flavor, size, message on the cake, and the
  pickup date, starting 48 hours from now.
- Checkout without an account: name, WhatsApp number, pickup date and time,
  notes. Payment at pickup.
- Confirmation screen with the order number.

### Day board (counter, on a tablet)

- One list per day with every order, grouped by pickup time; cakes highlighted
  with the date they are needed, visible from the day the order is placed.
- Three states per order: new, ready, picked up. One tap each.
- Orders by phone or at the counter can be added from the same board in under
  30 seconds.
- Product availability switch for the day.

### WhatsApp confirmation

- When an order is placed, the customer receives a confirmation with the order
  number and pickup time; when it is marked ready, a "ready for pickup" message.

### Site

- One page with the bakery, address, opening hours and a link to the order
  page. The current Instagram is linked, not rebuilt.

## 4. Out of scope (and why)

| Need | Stays in | Why |
| --- | --- | --- |
| Card payments and sales reports | Square | Already used in the shop and by the accountant |
| Photos and promotions | Instagram | 8k followers, works; the site links to it |
| Wholesale standing orders | Google Sheet | Nora: "it works fine" |
| Loyalty points | Paper stamp card | "Works ok"; revisit after launch |
| Delivery and driver tracking | Roadmap | One car, "maybe next year" |
| Online payment | Roadmap | Paying at pickup is fine for now |
| Reviews, gift cards, store apps | Roadmap | Nice to have, no pain behind them |

## 5. Who uses it

| Who | What they do in the first release |
| --- | --- |
| Customers | Browse today's menu, order ahead, order cakes with a date |
| Counter staff (2) | See and update the day board, add phone orders, set availability |
| Nora | Everything the staff does, plus edit products and prices |

## 6. Roadmap

1. **Online payment** at checkout, once order volume justifies the fee.
2. **Digital loyalty**, replacing the stamp card, if customers ask for it.
3. **Delivery**, when there is a driver.
4. **Wholesale order form** for cafés, if the Monday emails become a problem.
5. **Reviews and gift cards.**

## 7. Requirements

- Works on a basic tablet at the counter; large touch targets, no training.
- Customer data limited to name and WhatsApp number, used only for the order.
- Menu photos load fast on mobile data.

## 8. Deadline

Target: before the holiday season, in 7 weeks. The first release fits, with
room for a week of real use before the busiest days. The biggest threat is
pulling delivery, loyalty or online payment back in; each one alone would
consume the margin.

## 9. Open questions

1. Who owns juniperbakery.com and who can change its DNS?
2. The menu photos from the photographer (mentioned, not received).
3. The full product list with prices, and which items are daily.
4. Cake rules: sizes, flavors, maximum per day, cut-off time.
5. The WhatsApp number that will send confirmations.
6. Budget range, to confirm the approach in section 10.

## 10. Suggested approach

A small web app (order page and day board in the same project), hosted on a
managed platform, with WhatsApp messages through the official Business API.
No app store apps: the order page works in the phone's browser and the board
runs full screen on the tablet.
