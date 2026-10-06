# Component states: before · `body`

6 / 9 states with problems. API: **/api/orders.json*

- **Ready**: ok
- **Loading**: problem. gives no sign that it is loading
- **Empty**: problem. doesn't say there is nothing here, or what to do
- **One item**: ok
- **Many items**: ok
- **Missing fields**: problem. crashes: Cannot read properties of null (reading 'toUpperCase')
- **Server error**: problem. crashes: data.orders is not iterable; shows raw values: Invalid Date (doesn't say what happened or what to do)
- **Offline**: problem. crashes: Failed to fetch (doesn't say what happened or what to do)
- **No permission**: problem. crashes: data.orders is not iterable; shows raw values: Invalid Date (doesn't say what happened or what to do)