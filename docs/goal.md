# docs/goal.md


key goal of the diff merger logic:

enemies in this game should work like chess computers -
the level of the encounter determines how many turns ahead it can evaluate a position

encounters have a hierarchy of goals
these goals can be things like 'kill enemy', 'trigger blessings', 'stay alive', etc

the turn evaluation is cached and updated at state changes
if new info is added to the ai's context, then the cache is cleared and a new one is created
ideally, the ai would be able to think x turns ahead fast enough to make turn choices before the player

if possible, we will also redesign the ai to work together such that there is a hivemind
this hivemind would look at all move sequences for the entities and have them act as a mass

the goal of this all is, of course, to create the most realistic and competitively challenging opponents possible
