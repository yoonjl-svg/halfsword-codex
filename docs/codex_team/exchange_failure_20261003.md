# 일지 교환 실패 알림 진단 · 2026-10-03

대상: [Actions 실행37054234612 / job110994855009](https://github.com/yoonjl-svg/halfsword-codex/actions/runs/37054234612/job/110994855009).

## 확인한 사실과 한계

- 공개 작업 화면은 `Publish or receive fixed-day documents`와 `Surface failure after preserving its receipt` 두 단계의 exit1을 표시한다. 게임 빌드·배포 작업이 아니다. 4개 annotations는 오류2·Node20 경고1·Ubuntu 전환 공지1이며 서로 다른 오류4개가 아니다.
- 실행 소스는 `e5d2f081de320e42634526e27a68804baf754993`. 실행 생성은2026-10-02 19:27:29 UTC, 한국시간10월3일04:27:29다. 예약 예정 시각과 구별한다.
- 이 환경의 우리 저장소 Actions API 조회는 여전히401 Bad credentials다. 공개 웹은200이나 로그 본문은 로그인 필요다. 따라서 원격의 실제 mode·오류 본문은 미확인이다. 아래는 **동일 커밋에서 재현한 발행 결함**이며, 원격 실패의 직접 원인 확인을 대신하지 않는다.
- 상대 저장소/수신문서 조회, 원격 쓰기, 재실행은 하지 않았다.

## 동일 커밋에서 재현한 결함

당시 `docs/dev_exchange/notes/2026-10-02.md`는 처음6절 뒤88·97행에 두 개의 H2 후속 제목을 더해 전체8절이었다. 발행기는 정확한6절을 요구하여 `ValueError: Authored note must contain exactly six H2 sections`로 중단했다. 기존28개 단위 검사는 모두 통과했지만 실제 작성 노트를 검사하지 않아 놓쳤다.

재현은 당시 모듈·config를 로컬 임시 디렉터리에 복원하고 HEAD만 위 SHA로 고정한 읽기 전용 git wrapper를 사용했다. 나머지 git 자료는 같은 로컬 이력에서 읽었다. 발행 날짜10월2일/관찰시각19:27:29 UTC를 사용했으며 배포 조회는 빈 결과 mock으로 대체했다. 발행 mode는 원격에서 확인하지 못한 가정이다. 네트워크·상대 접촉은 없다.

## 로컬 수정과 검증

1. 현재 작성 노트의 추가 제목 두 개를 H3로 낮췄다.
2. 현재 파일을 고치는 것만으로 과거 마감 시점의 소스가 바뀌지는 않는다. 과거 미발행 원고에 한해, 정상1~6절 뒤의 무번호 H2만 렌더링 때 H3로 낮추고 변환 내역을 manifest에 남긴다. 원문 해시·내용·순서·기존 발행본은 보존한다. 잘못된 번호·누락·중복은 계속 거절한다.
3. `validate-notes`로 실제 작성 노트 전체를 검사한다. workflow에서는 publish/validate에만 실행하며 receive·시간창·실패 보존 동작을 바꾸지 않는다.
4. 코드 블록 안 제목은 절로 세지 않는다. 형식 오류·원문 해시·불변성·코드 블록 회귀를 추가해32검사 통과, 실제 작성 노트3개 통과, diff 검사 통과, 독립 읽기 감사에서 blocker 없음.

수정된 발행기로 **같은 e5d2f08 소스**를 재실행해52,898바이트 보고서를 생성했다. H2는6개, 제목 변경2개, 원문 노트 SHA 보존, manifest 검증 통과, 재실행 결과unchanged/동일 바이트를 확인했다. 생성된 보고서 SHA256은 `7416c3e26d3bee6b36ce2559b7dfe8cdeeeb7f97c3702fde5b4f5b9f910ea5f2`다. 이는 임시 로컬 출력이며 보고 가지에 발행한 것이 아니다.

명령:

```sh
python3 -B -m unittest discover -s tools/dev_exchange -p 'test_*.py'
python3 -B tools/dev_exchange/exchange.py validate-notes --repo-root .
```

재현 영수증: 저장소 밖 `/workspace/github-recovery/exchange-failure-37054234612-diagnosis.json`. 원격 인증 복구 후 정확한 실패 로그 확인→검증한 자동화 소스 전송→validate→필요한 과거 날짜 publish 순으로 확인한다. 수신은00:00–00:20 KST 밖에 재실행하지 않는다. 현재 상태는 **로컬 수정·검증 완료, 원격 반영·재실행 미완료**다.
