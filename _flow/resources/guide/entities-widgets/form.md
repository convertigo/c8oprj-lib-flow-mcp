# EntityForm business screens

Read before configuring create or edit forms and validation.

## Forms for business screens

`EntityForm` edits by field type: `text` is a multi-line area, `int64` and
`decimal` numeric inputs, an `enum` a list of its model labels with an empty
choice, a relation a list searched on the server when one page of options is
not enough (the current choice keeps its label). `fields` orders and selects
the shown fields (names or `{name, label, visibleWhen}`), and only they are
sent; `sections` groups them as `[{label, fields}]`. `visibleWhen:
{field, equals | in | notEmpty}` shows a field only for that value, and a
hidden field is not sent. `readOnly` forces consultation; it is presentation,
not authorization. Deletion asks a confirmation click (`confirmDelete:
false` removes it). Commands follow `locale` (`labels` overrides them).
`defaults={{status: "AVAILABLE"}}` gives the initial values of a creation.
Never add a model `default` to an existing field for that: the model write refuses it.
Business rules stay in the model hooks: a hidden or absent field is never a
server check.

For custom operation Flows read `flow://guide/entities-widgets/flows`.
