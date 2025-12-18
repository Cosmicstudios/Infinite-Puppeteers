// Stripe integration helper (optional)
// Usage: copy `.env.example` to `.env`, set STRIPE_SECRET_KEY and STRIPE_CLIENT_ID.
// This module is safe to include even if you don't run `npm install` — it will
// throw a clear error if Stripe is not configured.

function requireStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured. See backend/.env.example');
  // require at runtime so project can run without installing stripe unless used
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  return new Stripe(key, { apiVersion: '2023-08-16' });
}

async function createConnectAccount(email) {
  const stripe = requireStripe();
  // Create an Express account for a vendor
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email,
  });
  return account;
}

async function createAccountLink(accountId, refreshUrl, returnUrl) {
  const stripe = requireStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link;
}

async function createPaymentIntentForOrder({ orderId, amount, currency = 'usd', connectedAccountId = null, applicationFeeAmount = 0 }) {
  const stripe = requireStripe();
  // amount is in cents
  const params = {
    amount,
    currency,
    payment_method_types: ['card'],
    metadata: { orderId },
  };
  if (connectedAccountId) {
    // Send funds to connected account and take an application fee (platform commission)
    params.transfer_data = { destination: connectedAccountId };
    if (applicationFeeAmount && applicationFeeAmount > 0) params.application_fee_amount = applicationFeeAmount;
  }
  const pi = await stripe.paymentIntents.create(params);
  return pi;
}

async function handleWebhook(rawBody, sigHeader) {
  const stripe = requireStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, whSecret);
  } catch (err) {
    throw err;
  }
  return event;
}

module.exports = {
  createConnectAccount,
  createAccountLink,
  createPaymentIntentForOrder,
  handleWebhook,
};
