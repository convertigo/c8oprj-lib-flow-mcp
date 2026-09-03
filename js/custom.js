(function () {
  "use strict";

  var requestId = 0;

  function element(id) {
    return document.getElementById(id);
  }

  function endpointUrl() {
    return new URL("../../api/flow-mcp", window.location.href).toString();
  }

  async function callAdminTool(name, args) {
    var response = await fetch(endpointUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method: "tools/call",
        params: { name: name, arguments: args || {} }
      })
    });
    var payload;
    try {
      payload = await response.json();
    } catch (_invalidJson) {
      throw new Error("The Flow MCP endpoint returned an invalid response.");
    }
    if (!response.ok || payload.error) {
      throw new Error(payload.error && payload.error.message || "Flow MCP request failed (HTTP " + response.status + ").");
    }
    var result = payload.result && payload.result.structuredContent;
    if (!result || result.status !== "ok") {
      throw new Error(result && result.error && result.error.message || "Flow MCP token operation failed.");
    }
    return result;
  }

  function setMessage(message, tone) {
    var node = element("message");
    node.textContent = message || "";
    node.className = "message " + (tone || "");
  }

  function formatDate(value) {
    if (!value) return "never";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function renderTokens(tokens) {
    var list = element("token-list");
    var empty = element("empty-state");
    tokens = Array.isArray(tokens) ? tokens : [];
    list.replaceChildren();
    element("token-count").textContent = String(tokens.length);
    empty.hidden = tokens.length !== 0;
    tokens.forEach(function (token) {
      var fragment = element("token-template").content.cloneNode(true);
      var row = fragment.querySelector(".token-row");
      var status = token.status || "active";
      row.classList.toggle("inactive", status !== "active");
      fragment.querySelector(".token-name").textContent = token.name || token.id;
      var statusNode = fragment.querySelector(".token-status");
      statusNode.textContent = status;
      statusNode.classList.toggle("revoked", status !== "active");
      fragment.querySelector(".token-meta").textContent =
        "Created " + formatDate(token.createdAt) +
        " · expires " + formatDate(token.expiresAt) +
        " · last used " + formatDate(token.lastUsedAt);
      var revokeButton = fragment.querySelector(".revoke-button");
      revokeButton.hidden = status !== "active";
      revokeButton.addEventListener("click", function () {
        revokeToken(token.id, revokeButton);
      });
      list.appendChild(fragment);
    });
  }

  async function loadStatus() {
    try {
      var result = await callAdminTool("flow-token-status");
      element("admin-content").hidden = false;
      element("endpoint").textContent = result.mcpUrl || endpointUrl();
      element("environment-variable").textContent = result.tokenEnvironmentVariable || "CONVERTIGO_FLOW_MCP_TOKEN";
      renderTokens(result.tokens);
      var state = element("session-state");
      state.textContent = "WEB_ADMIN authenticated";
      state.className = "status-chip ok";
      setMessage("Secrets are stored under the Convertigo workspace JWT directory.", "ok");
    } catch (error) {
      element("admin-content").hidden = true;
      var state = element("session-state");
      state.textContent = "Admin authentication required";
      state.className = "status-chip error";
      setMessage(error.message || String(error), "error");
    }
  }

  async function createToken(event) {
    event.preventDefault();
    var submit = event.currentTarget.querySelector("button[type=submit]");
    submit.disabled = true;
    try {
      var result = await callAdminTool("flow-token-create", {
        name: element("token-name").value,
        expiresInDays: element("token-days").value
      });
      element("token-secret").textContent = result.token;
      element("secret-panel").hidden = false;
      renderTokens(result.tokens);
      event.currentTarget.reset();
      element("token-days").value = "365";
      setMessage("Token created. Copy it before dismissing the secret.", "ok");
    } catch (error) {
      setMessage(error.message || String(error), "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function revokeToken(tokenId, button) {
    button.disabled = true;
    try {
      var result = await callAdminTool("flow-token-revoke", { tokenId: tokenId });
      renderTokens(result.tokens);
      setMessage("Token revoked. Future requests using it will be rejected.", "ok");
    } catch (error) {
      button.disabled = false;
      setMessage(error.message || String(error), "error");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    element("create-form").addEventListener("submit", createToken);
    element("copy-button").addEventListener("click", async function () {
      await navigator.clipboard.writeText(element("token-secret").textContent);
      setMessage("Token copied to the clipboard.", "ok");
    });
    element("dismiss-secret").addEventListener("click", function () {
      element("token-secret").textContent = "";
      element("secret-panel").hidden = true;
    });
    loadStatus();
  });
}());
