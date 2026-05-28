import { assert, assertFalse } from "jsr:@std/assert@1";
import { canAccessAssistant, isEpicLifeEmail } from "../access.ts";

Deno.test("isEpicLifeEmail matches the marker case-insensitively", () => {
  assert(isEpicLifeEmail("epiclife.neessen@gmail.com"));
  assert(isEpicLifeEmail("Nick.EpicLife@x.com"));
  assert(isEpicLifeEmail("agent@epiclife.com"));
});

Deno.test("isEpicLifeEmail rejects non-Epic-Life and missing emails", () => {
  assertFalse(isEpicLifeEmail("nick@thestandardhq.com"));
  assertFalse(isEpicLifeEmail("agent@foundersfinancial.com"));
  assertFalse(isEpicLifeEmail(null));
  assertFalse(isEpicLifeEmail(undefined));
  assertFalse(isEpicLifeEmail(""));
});

Deno.test("canAccessAssistant: super-admins always pass", () => {
  assert(
    canAccessAssistant({ email: "anyone@anywhere.com", isSuperAdmin: true }),
  );
  assert(canAccessAssistant({ email: null, isSuperAdmin: true }));
});

Deno.test(
  "canAccessAssistant: non-super-admins need an Epic Life email",
  () => {
    assert(
      canAccessAssistant({
        email: "epiclife.neessen@gmail.com",
        isSuperAdmin: false,
      }),
    );
    assertFalse(
      canAccessAssistant({
        email: "nick@thestandardhq.com",
        isSuperAdmin: false,
      }),
    );
    assertFalse(canAccessAssistant({ email: null, isSuperAdmin: false }));
  },
);
