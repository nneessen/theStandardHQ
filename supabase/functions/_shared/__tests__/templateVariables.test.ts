import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  initEmptyVariables,
  replaceTemplateVariables,
} from "../templateVariables.ts";

Deno.test("text mode: replaces {{tag}} and {tag}, leaves values raw", () => {
  const vars = { recruit_first_name: "Mary-Jane" };
  assertEquals(
    replaceTemplateVariables("Hi {{recruit_first_name}}!", vars, "text"),
    "Hi Mary-Jane!",
  );
  assertEquals(
    replaceTemplateVariables("Hi {recruit_first_name}!", vars, "text"),
    "Hi Mary-Jane!",
  );
});

Deno.test("text mode is the default", () => {
  assertEquals(
    replaceTemplateVariables("{{user_name}}", { user_name: "Nick" }),
    "Nick",
  );
});

Deno.test("html mode: HTML-escapes injected values (XSS-safe body)", () => {
  const malicious = {
    recruit_first_name: `<img src=x onerror="alert(1)">`,
  };
  const out = replaceTemplateVariables(
    "<p>Hi {{recruit_first_name}}</p>",
    malicious,
    "html",
  );
  // No raw tag/quote survives; entities present.
  assertEquals(out.includes("<img"), false);
  assertStringIncludes(out, "&lt;img");
  assertStringIncludes(out, "&quot;");
  // The template's own markup is preserved (we only escape the value).
  assertStringIncludes(out, "<p>Hi ");
});

Deno.test(
  "html mode: ampersands and angle brackets in data are encoded",
  () => {
    const out = replaceTemplateVariables(
      "{{company_name}}",
      { company_name: "A & B <Co>" },
      "html",
    );
    assertEquals(out, "A &amp; B &lt;Co&gt;");
  },
);

Deno.test("subject mode: strips CR/LF (no email header injection)", () => {
  const out = replaceTemplateVariables(
    "Welcome {{recruit_last_name}}",
    { recruit_last_name: "Smith\r\nBcc: attacker@evil.com" },
    "subject",
  );
  assertEquals(out.includes("\n"), false);
  assertEquals(out.includes("\r"), false);
  assertStringIncludes(out, "Smith Bcc: attacker@evil.com");
});

Deno.test("subject mode: preserves hyphens and spaces in names", () => {
  const out = replaceTemplateVariables(
    "{{recruit_name}}",
    { recruit_name: "Mary-Jane  Watson" },
    "subject",
  );
  assertEquals(out, "Mary-Jane Watson"); // hyphen kept, double space collapsed
});

Deno.test(
  "$ sequences in values are inserted literally (no replace-pattern injection)",
  () => {
    // $& / $` / $' / $$ are String.replace special patterns; they must NOT be
    // interpreted when they appear in a DB-sourced value.
    assertEquals(
      replaceTemplateVariables("Hi {{recruit_name}}", { recruit_name: "A$&B" }),
      "Hi A$&B",
    );
    assertEquals(
      replaceTemplateVariables("[{{recruit_name}}]", {
        recruit_name: "x$`y$'z",
      }),
      "[x$`y$'z]",
    );
    assertEquals(
      replaceTemplateVariables("{{recruit_name}}", { recruit_name: "$$" }),
      "$$",
    );
  },
);

Deno.test("$ in html-mode value survives after entity-escaping", () => {
  assertEquals(
    replaceTemplateVariables(
      "{{company_name}}",
      { company_name: "A & $B" },
      "html",
    ),
    "A &amp; $B",
  );
});

Deno.test("initEmptyVariables prevents raw {{tags}} leaking when unset", () => {
  const vars = initEmptyVariables();
  assertEquals(
    replaceTemplateVariables("Hi {{recruit_first_name}}", vars, "text"),
    "Hi ",
  );
});
