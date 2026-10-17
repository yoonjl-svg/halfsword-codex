# 일본 유파 연구 원본 커밋

사용자 후속 요청: “일본 유파 연구 자료 원본 커밋이 필요하대. 디자인 작업이랑 별도로 그거 해둬.” 원 연구와 수신판에 맞춘 전달 커밋을 구분해 고정한다.

**일본 연구 마지막 원본: [`06c07a11e80a22b4baaf01406a2a9af6a48adc20`](https://github.com/yoonjl-svg/halfsword-codex/tree/06c07a11e80a22b4baaf01406a2a9af6a48adc20).**

- 저장소 `yoonjl-svg/halfsword-codex`
- 원본 가지 `codex/japanese-flow-redesign-20261017`
- 이 커밋 안에 아래 네 연구의 README·원자료·실패 기록·사진·도구가 함께 있다. 각 단계 시점도 아래에 고정한다.
- 세 번째 연구의 README에는 마지막 커밋에서 후속 연구 링크2줄만 추가됐다. 각 연구의 원자료 manifest는 해당 단계 원본과 동일하다. 단계 당시 설명을 그대로 보려면 표의 개별 커밋을 사용한다.
- 수신 최신 코드에 맞춘 전달 결과는 [`c8ca9c340527de0d60e88d4117f555f248d45d7e`](https://github.com/yoonjl-svg/halfsword-codex/tree/c8ca9c340527de0d60e88d4117f555f248d45d7e), 가지 `codex/japanese-research-handoff-20261017`이다. 원본 요청에는 `06c07a11`을 사용한다.

| 단계 | 최초/최종 연구 커밋 | 마지막 원본에서 바로 읽기 |
|---|---|---|
| 일본 막기 1차 | `702e6fde0a607cdab194e1dda77efb01f822f332` | [README·원자료](https://github.com/yoonjl-svg/halfsword-codex/tree/06c07a11e80a22b4baaf01406a2a9af6a48adc20/docs/research/japanese_flow_20261017) |
| 흘림 뒤 팔 회복 지연 | `15e18adf8b547ba393efb017a08ce2c730154279` (핵심 구현 `ad018bf78221fc3e68cbedffd1fbf7cccf7fd78f`) | [README·원자료](https://github.com/yoonjl-svg/halfsword-codex/tree/06c07a11e80a22b4baaf01406a2a9af6a48adc20/docs/research/japanese_recovery_20261017) |
| 판정·기력 개편 | `ebe8de5da77b2cb6b59645a36e30e0c3873ed111` | [README·원자료](https://github.com/yoonjl-svg/halfsword-codex/tree/06c07a11e80a22b4baaf01406a2a9af6a48adc20/docs/research/japanese_flow_redesign_20261017) |
| 가로 위협 선제 받기 | `06c07a11e80a22b4baaf01406a2a9af6a48adc20` | [README·원자료](https://github.com/yoonjl-svg/halfsword-codex/tree/06c07a11e80a22b4baaf01406a2a9af6a48adc20/docs/research/japanese_flow_intercept_20261017) |

받는 쪽 저장소에서 게임 가지를 변경하지 않고 원본을 확인하려면:

```sh
git fetch https://github.com/yoonjl-svg/halfsword-codex.git refs/heads/codex/japanese-flow-redesign-20261017
git show 06c07a11e80a22b4baaf01406a2a9af6a48adc20:docs/research/japanese_flow_intercept_20261017/README.md
```

`git fetch`만으로 현재 게임에 병합되거나 후보가 활성화되지 않는다. 전체 원본을 실제 게임에 적용할 때는 기존 전달본의 의존/기본 꺼짐/이식 검증 기록을 참고한다. 최신 후보는 인간 시험 추천이며30초 인간 순이득 확정은 아니다.

[기존 정식 전달 기록](JAPANESE_RESEARCH_HANDOFF_20261017.md), [이번 원격 커밋·자료 확인](japanese_source_commits_20261017.json). 원격4가지 SHA와 고정 원본의 README/manifest8개·압축 원자료1개를 확인한다. 원 연구/전달 커밋은 이미 발행된 상태이며, 이번에는 출처 안내만 별도 정리했다. 새 실험·게임 변경·새 상대 메시지 발송은 없다.
