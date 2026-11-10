# Flow Svelte Forms, Inputs And Dialogs

Input, Textarea, Combobox and choice controls with their events, Form submit, AlertDialog and dialogs, and the application locale.

Sub-guide of `flow://guide/frontend-svelte`: read that entry guide first for the authoring loop.

## Inputs, Choices And Dialogs

`Combobox` is the standard searchable choice. Its default contract is closed:
typing filters `options`, but only a proposed value is accepted. Set
`allowCustomValue={true}` when the field must also accept a new business
label; `@event.value` is then the selected value or the typed text, so one
backend Flow must resolve an existing id or create the value and reject an
empty label. Do not emulate this with `Input`, `ForEach` and buttons.
For options read from a `{id,name}` source, write `labelField="name" valueField="id"`
(`Combobox` and `Select`) rather than a native `<select>` or a manual mapping.

An `Input` or `Textarea` `value` only displays its binding. Use
`bind:value={page.name}` to write State on input, or an explicit event. Keep the text with an event and `@event.value`: `OnInput` runs
on each keystroke, `OnChange` when the edit is committed (leaving the field).
A free text on several lines (a comment, a description) is a `Textarea`
(`rows`, `maxlength`, `placeholder`, `required`), never a one-line `Input`;
its `@event.value` keeps the line breaks. `SearchField`, `ChatComposer`,
`Combobox` (its typed query) and `OtpInput` give `OnInput` the same
`@event.value`. To submit several fields together, place them with a
`Button type="submit"` in a `Form` and run the save from `Form` > `Events` >
`OnSubmit`, reading the page states.

An `AlertDialog` runs the confirmed command from `OnConfirm` (`@event.value`
is `"confirm"`) and a refusal from `OnCancel` (`"cancel"`, `"escape"` or
`"backdrop"`); `OnClose` runs each time it closes (`@event.value.reason`).
Bind its `open` to a page State that a Button sets to `true`: an
`AlertDialog`, `Modal`, `Drawer`, `ActionSheet` or `Popover` sets that State
back to `false` when it closes, so the next `SetValue` opens it again. A
widget runs a handler only for an event it emits (listed in its palette
entry) or a browser event of its element; any other one (an `OnConfirm` on a
`Button`) is refused with `FRONTEND_WIDGET_EVENT_UNKNOWN`.

A choice control keeps its choice the same way with `OnChange`; its `OnInput`
receives the same value (except a `Combobox`, whose `OnInput` gives the typed
query). `@event.value` is the chosen option value with its type (`Select`,
`RadioGroup`; `""` for the placeholder), an ISO date `YYYY-MM-DD`
(`DatePicker`), `HH:mm` (`TimePicker`), a number or `{ lower, upper }`
(`Range`), the item value as a string (`Segment`) or one value per column
(`WheelPicker`).

A date field that starts on today: `<DateToday $$id="today" $$out="page.day" />`
in the page `OnMount` and `<DatePicker value="@page.day" />` (`day` a declared
State; a result goes to `$$out`, `target` is for `SetValue`, `UpdateList` and
`UpdateNumber` only). `Status` is a widget, not an action: the `Then`/`Else` of
an `If` in `Actions` set a message State (`SetValue target="page.message"`)
that a `Text` of the page shows, and a `<Status actionId="save" successText="Saved." />`
beside the form shows the run, error and success of the action `save`.

```svelte
<Input $$id="noteInput" label="Note" value="@page.note"><Events>
  <OnInput $$id="typed"><Actions>
    <SetValue $$id="keepNote" target="page.note" value="@event.value" />
  </Actions></OnInput>
</Events></Input>
```

## Locale

A French application sets `locale="fr-FR"` (or binds it to the language
State) on `DataTable`, `DatePicker`, `Select` and `DisplayModeControl`: their
texts left at their default follow it (the empty choice of `Select`, the
labels of `DisplayModeControl`, the announcements of `DatePicker`); a text
written in the block is kept.

## Application locale and default component texts

Set the static application locale in the entry source metadata, for example
`export const _flow = {sourceVersion:2,app:{id:"App",title:"Application",locale:"fr-FR"}}` inside `<script module>`.
Generation sets the HTML language and supplies that locale to components whose locale was omitted. French applications
also receive French default control labels and placeholders. Authored labels, bindings, explicit component locales
and historical component defaults are preserved. Without app.locale, the translation catalog's default locale is
used, then English. A Translations variable can still select business translations dynamically; it does not change
this static application setting.
