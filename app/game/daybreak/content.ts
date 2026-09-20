import rawContent from "./daybreak-content.json";

export type DaybreakStory = {
  id: string;
  day: number;
  chapter: string;
  title: string;
  omen: string;
  narration: string[];
  thoughts: string[];
};

export type DaybreakSystemContent = {
  homeSceneId: string;
  nightfall: {
    kicker: string;
    title: string;
    message: string;
    sleepAction: string;
    laterAction: string;
  };
  daybreak: {
    kicker: string;
    title: string;
    location: string;
    quietMorning: string;
    openAction: string;
    listenAction: string;
    continueAction: string;
    finishAction: string;
    narratorLabel: string;
    thoughtLabel: string;
  };
  stories: DaybreakStory[];
};

export const DAYBREAK_CONTENT = rawContent as DaybreakSystemContent;

export function daybreakStoryForDay(day: number, completedIds: string[] = []) {
  return DAYBREAK_CONTENT.stories.find((story) => story.day === day && !completedIds.includes(story.id));
}

export function markDaybreakStorySeen(completedIds: string[], storyId?: string) {
  return storyId && !completedIds.includes(storyId) ? [...completedIds, storyId] : completedIds;
}
