export type TaobaoPublishDraft = {
  title: string;
  categoryPath: string;
  mainImages: string[];
  detailImages: string[];
};

export function createTaobaoDemoDraft(): TaobaoPublishDraft {
  return {
    title: '',
    categoryPath: '',
    mainImages: [],
    detailImages: [],
  };
}
