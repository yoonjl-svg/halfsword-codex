import './start_screen.css';
import './start_pixel.css';
import { mountStartScreen } from './start_screen.js';

// 픽셀 시안은 본 게임과 같은 계정 인증을 사용하며 여정 기록은 변경하지 않는다.
mountStartScreen({ pixelTheme: document.documentElement.dataset.startTheme === 'pixel' });
