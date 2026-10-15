import './start_screen.css';
import './start_pixel.css';
import { mountStartScreen } from './start_screen.js';

// 비교 시안은 게임의 진행/설정/계정 저장소를 읽거나 지우지 않는다.
mountStartScreen({ pixelTheme: document.documentElement.dataset.startTheme === 'pixel' });
