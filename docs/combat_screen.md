# docs/combat_screen.md


## Combat Screen Appearance
Combat is visualized as two rows of Combat Entities, each with a set of moves
Entities Show by default, and moves are visible by selecting 'view' on entities
By default, moves are hidden - when cast, moves become revealed

## Combat Screen Elements

### Example of a Combat Entity on Opposite Side
** Name **
Hp / MaxHp  --> shown as a Symbol and then two number values seperated by ' / '
Shields     --> shown as a list of Symbols, one for each shield. If 'Broken', shows yellow "!!" icon
** Sprite **
Attunements --> shown as a list of Symbol + number, showing only held attunements
Statuses    --> shown as a list of Symbol + number, showing only held statuses

### Example of a Combat Entity on Player Side
** Name **
Hp / MaxHp  --> shown as a Symbol and then two number values seperated by ' / '
Shields     --> shown as a list of Symbols, one for each shield. If 'Broken', shows yellow "!!" icon
Attunements --> shown as a list of Symbol + number, showing only held attunements
Statuses    --> shown as a list of Symbol + number, showing only held statuses
** Alternate Sprite **

### Example of a Move Card View
** cooldown / bound **  --> If on-cooldown, shown as symbol + number.
                            If bound, shown as symbol + binding-entity-name
                            If neither, does not show
** Name **
MoveElement / MoveType  --> shown as element-symbol | type-symbol
description             --> human-friendly move description

## CombatScreen Layout

+---------------------------------+
|        opposing entities        |
|                                 |
+---------------------------------+
|       General Prompt Popup      |
|                                 |
+---------------------------------+
|         players entities        |
|                                 |
+---------------------+-----------+
|     description     | choice 1  |
|                     | choice 2  |
|                     | choice 3  |
|                     | ...       |
+---------------------+-----------+
