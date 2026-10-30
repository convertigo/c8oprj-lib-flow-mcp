/* Shared pristine bootstrap source for safe adoption by authoring generators. */
(function(){
	function jsString(value) {
		return JSON.stringify(String(value || ""));
	}

	function initialSveltePage(name) {
		return [
			"<script module>",
			"  export const _flow = {",
			"  \"sourceVersion\": 2,",
			"  \"page\": {",
			"    \"id\": \"home\",",
			"    \"route\": \"/\",",
			"    \"title\": " + jsString(name) + ",",
			"  },",
			"};",
			"</script>",
			"",
			"<FlowComponent",
			"  $$id=\"home\"",
			"  label=" + jsString(name),
			">",
			"  <Structure>",
			"    <PageShell",
			"      $$id=\"pageShell\"",
			"      align=\"stretch\"",
			"      gap=\"16px\"",
			"      maxWidth=\"960px\"",
			"      padding=\"24px\"",
			"    ><Children>",
			"      <Card",
			"        $$id=\"welcomeCard\"",
			"        padding=\"20px\"",
			"        radius=\"8px\"",
			"        variant=\"surface\"",
			"      ><Children>",
			"        <Text",
			"          $$id=\"welcomeTitle\"",
			"          text=" + jsString(name),
			"        />",
			"        <Text",
			"          $$id=\"welcomeText\"",
			"          text=\"Flow Svelte frontend is ready.\"",
			"        />",
			"      </Children></Card>",
			"    </Children></PageShell>",
			"  </Structure>",
			"</FlowComponent>",
			""
		].join("\n");
	}

return {initialSveltePage:initialSveltePage};
}())
