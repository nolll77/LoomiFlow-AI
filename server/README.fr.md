# 🌍 Services Serveur & API

Gère les connexions aux services externes. L'architecture respecte scrupuleusement la logique : **Read via MCP, Write via REST**.

## Services
- **`mcp/`** : Client HTTP connecté au Loomi Connect MCP (utilise les outils `get_customer_properties`, `list_customer_events`, etc.). Gère la vérification OAuth.
- **`bloomreach/`** : Client REST API pour l'écriture. Met à jour les propriétés clients et déclenche les API Triggers (Scénarios de remédiation).
- **`paypal/`** : Récepteur de Webhooks simulant les défaillances de paiement e-commerce.
- **`websocket/` & `firebase/`** : Pour la mise à jour en temps réel de l'interface Cockpit UI sans rafraîchir la page.

[🇬🇧 English Version](./README.md)
