import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

c = c.replace("Camera, Gamepad2, Sparkles, Navigation, BarChart3, EyeOff, Volume2, Sun, Moon, UploadCloud, ShieldCheck, User as UserIcon, LogIn, Play, Pause, Zap, BatteryCharging, Send, X", "EyeOff")
c = c.replace("import { AppLifecycleService } from './services/appLifecycleService';\n", "")
c = re.sub(r"const \[authUser, setAuthUser\].*\n", "", c)
c = re.sub(r"const \[isPushDismissed, setIsPushDismissed\].*\n", "", c)
c = re.sub(r"const \[ebikePushMessage, setEbikePushMessage\].*\n", "", c)
c = re.sub(r"const handlePushToEBikeNav = async \(\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?\}[\s\S]*?\}\n", "", c)

with open('src/App.tsx', 'w') as f:
    f.write(c)

with open('src/components/Navigation/BurgerMenu.tsx', 'r') as f:
    c = f.read()
c = c.replace(", EyeOff", "")
with open('src/components/Navigation/BurgerMenu.tsx', 'w') as f:
    f.write(c)
