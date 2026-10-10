import assert from "node:assert/strict";
import test from "node:test";
import { chatAfter, chatBefore, discount, loginAfter, loginBefore, paymentAfter, paymentBefore } from "../dist/examples/reference/application.js";
import { fixture, processById } from "./helpers.mjs";

const attempt = { cancelled: false, credentialsValid: true, accountEnabled: true };
const purchase = { price: 1000, activeSubscription: true, gatewayResults: ["paid"], verificationSucceeded: true };

test("login bug fix rejects a disabled account and preserves error, retry, and cancellation behavior", () => {
  const disabled = [{ ...attempt, accountEnabled: false }];
  assert.equal(loginBefore(disabled), "signed-in");
  assert.equal(loginAfter(disabled), "disabled");
  assert.equal(loginAfter([attempt]), "signed-in");
  assert.equal(loginAfter([{ ...attempt, cancelled: true }]), "cancelled");
  assert.equal(loginAfter([{ ...attempt, credentialsValid: false }, attempt]), "signed-in");
  assert.equal(loginAfter(Array(4).fill({ ...attempt, credentialsValid: false })), "attempts-exhausted");
  assert.equal(loginAfter([]), "attempts-exhausted");
});

test("discount feature includes full discount, partial discount, rejection, and normal payment", () => {
  assert.equal(paymentBefore({ ...purchase, discountPercent: 100 }), "paid");
  assert.equal(paymentAfter({ ...purchase, discountPercent: 100, gatewayResults: ["declined"] }), "free");
  assert.equal(paymentAfter({ ...purchase, discountPercent: 25 }), "paid");
  assert.equal(discount(1000, 25, true), 750);
  assert.equal(paymentAfter(purchase), "paid");
  for (const percent of [-1, 101, 1.5, NaN]) assert.equal(paymentAfter({ ...purchase, discountPercent: percent }), "invalid-discount");
  assert.equal(paymentAfter({ ...purchase, discountPercent: 25, activeSubscription: false }), "invalid-discount");
});

test("payment completion requires verification and pending work is never reported as paid", () => {
  for (const pay of [paymentBefore, paymentAfter]) {
    assert.equal(pay({ ...purchase, verificationSucceeded: false }), "failed");
    assert.equal(pay({ ...purchase, gatewayResults: ["declined"] }), "failed");
    assert.equal(pay({ ...purchase, gatewayResults: ["cancelled"] }), "cancelled");
    assert.equal(pay({ ...purchase, gatewayResults: ["pending"] }), "waiting");
    assert.equal(pay({ ...purchase, gatewayResults: ["timeout", "paid"] }), "paid");
    assert.equal(pay({ ...purchase, gatewayResults: ["pending", "paid"] }), "paid");
    for (const price of [-1, 0, 0.5, Infinity]) assert.equal(pay({ ...purchase, price }), "invalid-price");
  }
});

test("chat's background change separates queued or waiting work from a delivered reply", () => {
  assert.equal(chatBefore(true, "ready"), "reply-delivered");
  assert.equal(chatBefore(true, "failed"), "failed");
  assert.equal(chatBefore(false, "ready"), "subscription-required");
  assert.equal(chatAfter(true, ["pending"]), "waiting");
  assert.equal(chatAfter(true, ["pending", "ready"]), "reply-delivered");
  assert.equal(chatAfter(true, ["failed"]), "failed");
  assert.equal(chatAfter(false, ["ready"]), "subscription-required");
});

test("reference maps encode the actual changed decisions and continuations", async () => {
  const before = await fixture("before");
  const after = await fixture("after");
  const oldLogin = processById(before, "login");
  const newLogin = processById(after, "login");
  assert.equal(oldLogin.edges.find(edge => edge.id === "login.credentials-accepted").to, "login.success");
  assert.equal(newLogin.edges.find(edge => edge.id === "login.credentials-accepted").to, "login.enabled");
  assert.ok(newLogin.edges.some(edge => edge.from === "login.enabled" && edge.to === "login.disabled" && edge.condition === "Account is disabled"));
  const payment = processById(after, "payment");
  assert.ok(payment.edges.some(edge => edge.from === "payment.zero" && edge.to === "payment.free" && edge.condition === "Amount due equals zero"));
  assert.ok(payment.edges.some(edge => edge.from === "payment.zero" && edge.to === "payment.gateway" && edge.condition === "Amount due is greater than zero"));
  assert.ok(payment.edges.some(edge => edge.from === "payment.accepted" && edge.to === "payment.invalid-discount"));
  const chat = processById(after, "chat");
  assert.ok(chat.nodes.some(node => node.id === "chat.wait" && node.kind === "wait"));
  assert.ok(!processById(before, "chat").nodes.some(node => node.id === "chat.wait"));
  assert.ok(chat.edges.some(edge => edge.from === "chat.result" && edge.to === "chat.wait"));
});
