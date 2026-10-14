# Payroll Contract Tests

These tests are lightweight and use **hotpocket-js-client** to communicate with a running HotPocket instance.

## Run
1. Deploy the contract to a local cluster (example: `npm start`).
2. In another terminal:

```bash
node src/Test/run-tests.js
```

> Adjust `CONTRACT_URL` in `test-utils.js` if your instance uses a different port.
