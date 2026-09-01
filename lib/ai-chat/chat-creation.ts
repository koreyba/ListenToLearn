import type { AiChatTargetInput } from "./contracts.ts";
import { createAiChatRepository } from "./repository.ts";
import { createVocabularyRepository } from "../vocabulary/repository.ts";
import { buildVocabularyOpeningMessage } from "./vocabulary-tools.ts";

type ChatCreationRepository = Pick<
  ReturnType<typeof createAiChatRepository>,
  "createChat"
>;

type VocabularyRepository = Pick<
  ReturnType<typeof createVocabularyRepository>,
  "listRecent"
>;

export async function createChatWithVocabularyOpening(input: {
  chatRepository: ChatCreationRepository;
  vocabularyRepository: VocabularyRepository;
  userId: string;
  targets: readonly AiChatTargetInput[];
}) {
  const recentVocabulary = await input.vocabularyRepository.listRecent(input.userId, 5);
  return input.chatRepository.createChat(input.userId, {
    targets: input.targets,
    openingMessage: buildVocabularyOpeningMessage(recentVocabulary),
  });
}
