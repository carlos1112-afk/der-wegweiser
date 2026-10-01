import re

# Fix UILayoutContext
with open('src/contexts/UILayoutContext.tsx', 'r') as f:
    c = f.read()
c = c.replace("import React, { createContext, useContext, useState, ReactNode }", "import React, { createContext, useContext, useState }\nimport type { ReactNode }")
with open('src/contexts/UILayoutContext.tsx', 'w') as f:
    f.write(c)

# Fix ConsentModal
with open('src/components/Legal/ConsentModal.tsx', 'r') as f:
    c = f.read()
c = c.replace("import confetti from 'canvas-confetti';\n", "")
with open('src/components/Legal/ConsentModal.tsx', 'w') as f:
    f.write(c)

# Fix App.tsx
with open('src/App.tsx', 'r') as f:
    c = f.read()

# Inject the hooks
if "const { isMainMenuOpen" not in c:
    c = c.replace("export function App() {", "export function App() {\n  const { isMainMenuOpen, setMainMenuOpen, isSearchActive, setSearchActive } = useUILayout();\n")

with open('src/App.tsx', 'w') as f:
    f.write(c)
