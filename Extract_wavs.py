import json
import os
import shutil

BASE = r"C:\Users\user\OneDrive\바탕 화면\Wavetapper-main"
WAV_SRC = os.path.join(BASE, "wav")
WAV_DST = os.path.join(BASE, "wav_used")

WAV_FOLDERS = [
    'Drums','Chord','FA Front','FA Back',
    'WWDTM High','WWDTM Low','SF Roll','SF Tap',
    'PM','Arp','Noise','DTMF',
    'Bass','Spreader','Radiolab',''
]

# data.js의 Sounds 배열을 직접 파이썬으로 재현
# (data.js eval 대신 직접 정의)
SOUNDS = {
    0: ["Kick_Long","Kick_Short","Kick_Short_Quiet","Noise_High_80","Noise_Low_40","Noise_Low_80","Noise_Shot_20","Noise_Shot_60","Noise_Shot_80"],
    1: ([f"Lock_A_{str(i).zfill(3)}" for i in range(32)]
      + [f"Lock_B_{str(i).zfill(3)}" for i in range(40)]
      + [f"Flow_A_{str(i).zfill(3)}" for i in range(64)]
      + [f"Flow_B_{str(i).zfill(3)}" for i in range(80)]),
    2: ["ih","so","yi"],
    3: ["gure"],
    4: ["play_10","play_20","play_30","play_80"],
    5: ["gil","ha"],
    6: ["nu","qi_Cut_20","qi_Cut_40","qi_Long","qi_Short"],
    7: ["di"],
    8: ["ba","but","cu","dis","ki","mi","net","sha","su_Long","su_Short"],
    9: [str(i+1).zfill(3) for i in range(205)],
    10: ["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","Break","Hum","In"],
    11: ["Break","Busy_Long","Busy_Short","Dial","Hang-Up","Off-Hook_Long","Off-Hook_Short","Ringback_Long","Ringback_Short","ABC","DEF","GHI","JKL","MNO","PQRS","TUV"],
    12: ["1","2","3","4","5"],
    13: ([f"A_{str(i).zfill(3)}" for i in range(24)]
       + [f"B_{str(i).zfill(3)}" for i in range(24)]
       + [f"C_{str(i+16).zfill(3)}" for i in range(8)]),
    14: [str(i+1).zfill(3) for i in range(168)],
    15: [],
}

copied = 0
skipped = 0

for block_id in range(16):
    folder = WAV_FOLDERS[block_id]
    if not folder:
        continue

    # song.json 로드
    song_path = os.path.join(BASE, "song", f"{block_id}.json")
    with open(song_path, encoding='utf-8') as f:
        song = json.load(f)

    # 실제 쓰이는 사운드 인덱스 추출
    needed = set()
    for bar in song:
        for ev in bar:
            needed.add(ev[1])

    print(f"\n[{block_id}] {folder} - {len(needed)}개 사용")

    dst_folder = os.path.join(WAV_DST, folder)
    os.makedirs(dst_folder, exist_ok=True)

    sounds = SOUNDS.get(block_id, [])
    for idx in sorted(needed):
        if idx >= len(sounds):
            continue
        name = sounds[idx]
        src = os.path.join(WAV_SRC, folder, f"{name}.wav")
        dst = os.path.join(dst_folder, f"{name}.wav")
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print(f"  ✓ {name}.wav")
            copied += 1
        else:
            print(f"  ✗ {name}.wav (없음)")
            skipped += 1

print(f"\n완료! 복사: {copied}개 / 없음: {skipped}개")
print(f"저장 위치: {WAV_DST}")