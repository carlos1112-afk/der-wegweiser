with open('src/contexts/UILayoutContext.tsx', 'r') as f:
    c = f.read()

c = c.replace("import React, { createContext, useContext, useState }\nimport type { ReactNode } from 'react';", "import React, { createContext, useContext, useState } from 'react';\nimport type { ReactNode } from 'react';")

with open('src/contexts/UILayoutContext.tsx', 'w') as f:
    f.write(c)
