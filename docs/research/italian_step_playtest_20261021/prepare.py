from pathlib import Path
import subprocess,sys,tarfile,io,shutil
src=Path(__file__).resolve().parent;repo=next(p for p in src.parents if (p/'.git').exists());out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
if subprocess.run(['git','cat-file','-e','9a8f4bcc14771d336c7ee75b9cea90bff7bc86c3^{commit}'],cwd=repo,capture_output=True).returncode:
 subprocess.run(['git','fetch','https://github.com/yoonjl-svg/halfsword.git','9a8f4bcc14771d336c7ee75b9cea90bff7bc86c3'],cwd=repo,check=True)
b=subprocess.check_output(['git','archive','9a8f4bcc14771d336c7ee75b9cea90bff7bc86c3','src','public','index.html','package.json','package-lock.json'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(b)) as t:t.extractall(out,filter='data')
shutil.copytree(src.parent/'italian_four_playtest_20261020/overlay',out,dirs_exist_ok=True);shutil.copytree(src.parent/'italian_body_playtest_20261021/overlay',out,dirs_exist_ok=True);shutil.copytree(src/'overlay',out,dirs_exist_ok=True);(out/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
shutil.copy(src/'step_comparison.mjs',out/'tools/sim/step_comparison.mjs')
print(out)
