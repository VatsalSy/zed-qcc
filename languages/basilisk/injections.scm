; Optional markdown injection for C-style doc comments.
((comment) @injection.content
  (#match? @injection.content "^///")
  (#set! injection.language "markdown"))
