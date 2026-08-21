# Testing

- **Every feature must be unit tested.** A feature is not done without tests.
- Tests are colocated inside the feature they cover, so deleting the feature
  deletes its tests. Never a top-level mirror tree.
- Test behaviour through the feature's public surface, not its internals.
- Logic in `lib/` is tested directly; components are tested through rendered
  behaviour, not implementation details.
- Design-system components are tested against their own contract — props, states,
  accessibility — independently of any feature.

See also: [architecture.md](architecture.md).
