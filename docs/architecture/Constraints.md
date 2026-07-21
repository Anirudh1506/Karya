# Architectural Constraints

1. Karya is one platform with multiple clients.
2. Business logic remains independent of presentation frameworks.
3. Clients present Core capabilities and register adapters.
4. Event Bus is the shared mechanism for completed platform facts.
5. Domain and service packages do not depend on Electron or React Native.
6. Shared root entry points do not resolve Node-only implementations.
7. Persistence contracts remain independent of SQLite libraries.
8. Desktop-native adapters remain isolated and replaceable.
9. Mobile does not import Desktop UI or adapters.
10. State ownership remains separated by lifecycle and meaning.
11. Local work must not require permanent connectivity.
12. New packages require a current, coherent responsibility.
13. Existing working behavior is preserved unless an approved migration requires change.
14. Structural change must measurably improve reuse, independence, maintainability, or scale.
15. Product features are delivered as vertical slices after the platform foundation is verified.
