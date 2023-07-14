# RW Lazy Installer

## Installation

`npm i -g rw-lazy-installer`

## Commands:

- `rw-lazy-installer check [--dir <mod dir>]` Checks for existing repositories in the mod dir
- `rw-lazy-installer install <mod> [--dir <mod dir>]` Installs a mod or sub mod in the mod dir
- `rw-lazy-installer update [-l|--log] [-r|--relevant] [--dir <mod dir>]` Updates all installed (and known) mods in the mod dir, showing the git log (last 5) when updating (`--relevant`) or always (`--log`)
- `rw-lazy-installer help` The help

### Help

```
______ _    _   _                       _____          _        _ _           
| ___ \ |  | | | |                     |_   _|        | |      | | |          
| |_/ / |  | | | |     __ _ _____   _    | | _ __  ___| |_ __ _| | | ___ _ __ 
|    /| |/\| | | |    / _` |_  / | | |   | || '_ \/ __| __/ _` | | |/ _ \ '__|
| |\ \\  /\  / | |___| (_| |/ /| |_| |  _| || | | \__ \ || (_| | | |  __/ |   
\_| \_|\/  \/  \_____/\__,_/___|\__, |  \___/_| |_|___/\__\__,_|_|_|\___|_|   
                                __/ |                                        
                                |___/                                         

You have installed:

        RJW EX                                             rjw-ex                         [Rimworld Dir]/Mods/rjw-ex
        RimJobWorld                                        rjw-master                     [Rimworld Dir]/Mods/rjw-master
        RJW Race Support                                   rjw-race-support               [Rimworld Dir]/Mods/rjw-race-support

Install or update the mods with the install or update command.


Installable mods:


        RJW MC                                             rjw-mc                         https://gitgud.io/Ed86/rjw-mc.git
        RJW Animations                                     Rimworld-Animations            https://gitgud.io/c0ffeeeeeeee/rimworld-animations.git
        AnimAddons - Animal Patch                          rjwanimaddons-animalpatch      https://gitgud.io/Tory/rjwanimaddons-animalpatch.git
        AnimAddons - Xtra Anims                            rjwanimaddons-xtraanims        https://gitgud.io/Tory/rjwanimaddons-xtraanims.git
        AnimAddons - Voice Patch                           animaddons-voicepatch          https://gitgud.io/Tory/animaddons-voicepatch.git
        Licentia Labs                                      licentia-labs                  https://gitgud.io/John-the-Anabaptist/licentia-labs.git
        Nephila RJW                                        nephila-rjw                    https://gitgud.io/HiveBro/nephila-rjw.git
        RJW Menstruation                                   RJW_Menstruation               https://github.com/moreoreganostodump/RJW_Menstruation.git
        s16's Extension                                    s16s-extension                 https://gitlab.com/Hazzer/s16s-extension.git
        RJW Events                                         rjw-events                     https://gitgud.io/c0ffeeeeeeee/rjw-events.git
        SCC Lewd Sculptures                                scc-lewd-sculptures            https://gitgud.io/SpiritCookieCake/scc-lewd-sculptures.git
        RimJobWorld Ideology Addon                         rimjobworld-ideology-addon     https://gitgud.io/Tittydragon/rimjobworld-ideology-addon.git
        coffees RJW Ideology Addons                        coffees-rjw-ideology-addons    https://gitgud.io/c0ffeeeeeeee/coffees-rjw-ideology-addons.git
        RJW Sexperience                                    RJW-Sexperience                https://github.com/moreoreganostodump/RJW-Sexperience.git
        BetterRJW - Do not install together with RJW       betterrjw                      https://gitgud.io/EaglePhntm/betterrjw.git
        RJW Whorebeds                                      rjw-Whorebeds                  https://gitgud.io/Ed86/rjw-whorebeds.git
        Rimnosis NSFW                                      Rimnosis                       https://github.com/WolfoftheWest/Rimnosis.git


        i.e. $ rw-lazy-installer install rjw-ex
```