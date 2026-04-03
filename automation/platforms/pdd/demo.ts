import type { PddPublishProductPayload } from '@/utils/remoteAutomation';

export const PDD_DEMO_ASSET_DIR =
  'C:\\Users\\admin\\Desktop\\拼多多_抗菌垫';

const MAIN_IMAGE_DIR = `${PDD_DEMO_ASSET_DIR}\\主图`;
const DETAIL_IMAGE_DIR = `${PDD_DEMO_ASSET_DIR}\\详情图`;
const SKU_IMAGE_DIR = `${PDD_DEMO_ASSET_DIR}\\SKU`;

const CAROUSEL_IMAGES = [
  `${MAIN_IMAGE_DIR}\\主图01.jpg`,
  `${MAIN_IMAGE_DIR}\\主图02.jpg`,
  `${MAIN_IMAGE_DIR}\\主图03.jpg`,
  `${MAIN_IMAGE_DIR}\\主图04.jpg`,
  `${MAIN_IMAGE_DIR}\\主图05.jpg`,
  `${MAIN_IMAGE_DIR}\\主图06.jpg`,
  `${MAIN_IMAGE_DIR}\\主图07.jpg`,
  `${MAIN_IMAGE_DIR}\\主图08.jpg`,
  `${MAIN_IMAGE_DIR}\\主图09.jpg`,
  `${MAIN_IMAGE_DIR}\\主图10.jpg`,
];

const DETAIL_IMAGES = [
  `${DETAIL_IMAGE_DIR}\\详情图01.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图02.png`,
  `${DETAIL_IMAGE_DIR}\\详情图03.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图04.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图05.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图06.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图07.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图08.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图09.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图10.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图11.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图12.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图13.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图14.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图15.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图16.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图17.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图18.jpg`,
  `${DETAIL_IMAGE_DIR}\\详情图19.jpg`,
];

export function createPddDemoPayload(): PddPublishProductPayload {
  return {
    categoryKeyword: '运动/瑜伽/健身/球类>瑜伽装备>瑜伽垫',
    categorySelectionMode: 'exact',
    categorySelectionText: '运动/瑜伽/健身/球类 > 瑜伽装备 > 瑜伽垫',
    title: '凯蒂抗菌防滑瑜伽垫 加宽加厚家用健身垫',
    carouselImages: CAROUSEL_IMAGES,
    detailImages: DETAIL_IMAGES,
    specs: [
      {
        name: '颜色',
        values: ['粉色', '紫色'],
      },
      {
        name: '尺寸',
        values: ['185x70cm6mm', '185x70cm8mm'],
      },
    ],
    skuRows: [
      {
        specs: ['粉色', '185x70cm6mm'],
        stock: 100,
        groupPrice: 59.9,
        singlePrice: 69.9,
        previewImage: `${SKU_IMAGE_DIR}\\SKU01_粉色-凯蒂(抗菌防滑)_185x70cm6mm（基础入门）.jpg`,
        skuCode: 'KT-PINK-70-6',
        enabled: true,
      },
      {
        specs: ['粉色', '185x70cm8mm'],
        stock: 80,
        groupPrice: 79.9,
        singlePrice: 89.9,
        previewImage: `${SKU_IMAGE_DIR}\\SKU02_粉色-凯蒂(抗菌防滑)_185x70cm8mm（基础入门）.jpg`,
        skuCode: 'KT-PINK-70-8',
        enabled: true,
      },
      {
        specs: ['紫色', '185x70cm6mm'],
        stock: 120,
        groupPrice: 61.9,
        singlePrice: 71.9,
        previewImage: `${SKU_IMAGE_DIR}\\SKU13_紫色-凯蒂(抗菌防滑)_185x70cm6mm（基础入门）.jpg`,
        skuCode: 'KT-PURPLE-70-6',
        enabled: true,
      },
      {
        specs: ['紫色', '185x70cm8mm'],
        stock: 90,
        groupPrice: 81.9,
        singlePrice: 91.9,
        previewImage: `${SKU_IMAGE_DIR}\\SKU14_紫色-凯蒂(抗菌防滑)_185x70cm8mm（基础入门）.jpg`,
        skuCode: 'KT-PURPLE-70-8',
        enabled: true,
      },
    ],
  };
}
