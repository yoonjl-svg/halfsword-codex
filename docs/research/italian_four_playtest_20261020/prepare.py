from pathlib import Path
import subprocess,sys,tarfile,io,shutil
src=Path(__file__).resolve().parent;repo=next(p for p in src.parents if (p/'.git').exists());out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
b=subprocess.check_output(['git','archive','9a8f4bcc14771d336c7ee75b9cea90bff7bc86c3','src','public','index.html','package.json','package-lock.json'],cwd=repo)
with tarfile.open(fileobj=io.BytesIO(b)) as t:t.extractall(out,filter='data')
shutil.copytree(src/'overlay',out,dirs_exist_ok=True);(out/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
print(out)
